import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
  isNull,
  notExists,
  or,
  sql,
} from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import {
  examQuestions,
  exams,
  questionExplanations,
  questionImages,
  questions,
} from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"
import { cdnUrl } from "@/lib/cdn"

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(Math.max(lo, Math.floor(n)), hi)

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&")

// EXISTS / NOT EXISTS corrélé sur les images d'une question (filtre « avec/sans
// images » sans colonne dénormalisée).
// Scopé `kind='statement'` : les compteurs/filtres admin reflètent les images
// d'ÉNONCÉ (sens admin actuel), pas celles d'explication.
const hasImagesSubquery = exists(
  db
    .select({ x: sql`1` })
    .from(questionImages)
    .where(
      and(
        eq(questionImages.questionId, questions.id),
        eq(questionImages.kind, "statement"),
      ),
    ),
)
const noImagesSubquery = notExists(
  db
    .select({ x: sql`1` })
    .from(questionImages)
    .where(
      and(
        eq(questionImages.questionId, questions.id),
        eq(questionImages.kind, "statement"),
      ),
    ),
)

// EXISTS / NOT EXISTS corrélé sur `examQuestions` : filtre « déjà utilisée dans
// un examen » (badge + filtre d'usage du QuestionBrowser).
const usedSubquery = exists(
  db
    .select({ x: sql`1` })
    .from(examQuestions)
    .where(eq(examQuestions.questionId, questions.id)),
)
const unusedSubquery = notExists(
  db
    .select({ x: sql`1` })
    .from(examQuestions)
    .where(eq(examQuestions.questionId, questions.id)),
)
const usedInExamSubquery = (examId: string) =>
  exists(
    db
      .select({ x: sql`1` })
      .from(examQuestions)
      .where(
        and(
          eq(examQuestions.questionId, questions.id),
          eq(examQuestions.examId, examId),
        ),
      ),
  )

// ============================================
// [Admin] Liste paginée (keyset) + filtres
// ============================================

export type QuestionListItem = {
  id: string
  question: string
  domain: string
  objectifCMC: string
  options: string[]
  /** Epoch ms. */
  createdAt: number
  imageCount: number
  /** Nombre d'examens référençant cette question. */
  usageCount: number
}

export type QuestionsPage = {
  items: QuestionListItem[]
  /** Total filtré (pagination numérotée). */
  total: number
}

export type QuestionFiltersInput = {
  /** 1-based. */
  page?: number
  limit?: number
  search?: string
  domain?: string
  hasImages?: boolean
  sortOrder?: "asc" | "desc"
  usageFilter?: "all" | "used" | "unused"
  usedInExamId?: string
}

/**
 * [Admin] Questions filtrées + paginées (offset `page`/`limit` + `total` pour la
 * pagination numérotée). Recherche ILIKE sur le texte ET l'objectif CMC, filtre
 * domaine, filtre images et filtre usage examen via EXISTS corrélés. Comptes
 * d'images et d'usage batchés (pas de N+1). Ordre stable (tie-break id). Garde admin.
 */
export const getQuestionsWithFilters = async ({
  page = 1,
  limit = 50,
  search,
  domain,
  hasImages,
  sortOrder = "desc",
  usageFilter = "all",
  usedInExamId,
}: QuestionFiltersInput = {}): Promise<QuestionsPage> => {
  await requireRole(["admin"])

  // `Number.isFinite` : un `page`/`limit` forgé (NaN/Infinity) ne doit pas
  // traverser le clamp (Math.max(1, NaN) === NaN → erreur SQL).
  const safeLimit = clamp(Number.isFinite(limit) ? limit : 50, 1, 100)
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
  const offset = (safePage - 1) * safeLimit
  const isDesc = sortOrder !== "asc"

  const searchTerm = search?.trim()

  // `usedInExamId` prime sur used/unused (l'UI garantit l'exclusion mutuelle).
  const usagePredicate = usedInExamId
    ? usedInExamSubquery(usedInExamId)
    : usageFilter === "used"
      ? usedSubquery
      : usageFilter === "unused"
        ? unusedSubquery
        : undefined

  const where = and(
    isNull(questions.deletedAt),
    domain && domain !== "all" ? eq(questions.domain, domain) : undefined,
    searchTerm
      ? or(
          ilike(questions.question, `%${escapeLike(searchTerm)}%`),
          ilike(questions.objectifCmc, `%${escapeLike(searchTerm)}%`),
        )
      : undefined,
    hasImages === undefined
      ? undefined
      : hasImages
        ? hasImagesSubquery
        : noImagesSubquery,
    usagePredicate,
  )

  const order = isDesc
    ? [desc(questions.createdAt), desc(questions.id)]
    : [asc(questions.createdAt), asc(questions.id)]

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: questions.id,
        question: questions.question,
        domain: questions.domain,
        objectifCMC: questions.objectifCmc,
        options: questions.options,
        createdAt: questions.createdAt,
      })
      .from(questions)
      .where(where)
      .orderBy(...order)
      .limit(safeLimit)
      .offset(offset),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(questions)
      .where(where),
  ])

  const total = totalRows[0]?.n ?? 0
  const pageIds = rows.map((r) => r.id)

  const [imageCounts, usageCounts] = pageIds.length
    ? await Promise.all([
        db
          .select({
            questionId: questionImages.questionId,
            n: sql<number>`count(*)`.mapWith(Number),
          })
          .from(questionImages)
          .where(
            and(
              eq(questionImages.kind, "statement"),
              inArray(questionImages.questionId, pageIds),
            ),
          )
          .groupBy(questionImages.questionId),
        db
          .select({
            questionId: examQuestions.questionId,
            n: sql<number>`count(*)`.mapWith(Number),
          })
          .from(examQuestions)
          .where(inArray(examQuestions.questionId, pageIds))
          .groupBy(examQuestions.questionId),
      ])
    : [[], []]

  const imageMap = new Map(imageCounts.map((c) => [c.questionId, c.n]))
  const usageMap = new Map(usageCounts.map((c) => [c.questionId, c.n]))

  const items: QuestionListItem[] = rows.map((r) => ({
    id: r.id,
    question: r.question,
    domain: r.domain,
    objectifCMC: r.objectifCMC,
    options: r.options,
    createdAt: r.createdAt.getTime(),
    imageCount: imageMap.get(r.id) ?? 0,
    usageCount: usageMap.get(r.id) ?? 0,
  }))

  return { items, total }
}

// ============================================
// [Admin] Question complète (panel + édition)
// ============================================

export type QuestionImageView = {
  id: string
  storagePath: string
  position: number
}

export type QuestionDetail = {
  id: string
  question: string
  options: string[]
  correctAnswer: string
  objectifCMC: string
  domain: string
  /** Epoch ms. */
  createdAt: number
  explanation: string
  references: string[] | null
  /** Images d'énoncé (`kind='statement'`). */
  images: QuestionImageView[]
  /** Images d'explication (`kind='explanation'`), affichées à la correction. */
  explanationImages: QuestionImageView[]
}

/**
 * [Admin] Question par id, jointe à son explication (1:1) et ses images (enfant,
 * triées). Remplace `getQuestionById`. `null` si introuvable / supprimée.
 */
export const getQuestionById = async (
  id: string,
): Promise<QuestionDetail | null> => {
  await requireRole(["admin"])

  const [q] = await db
    .select({
      id: questions.id,
      question: questions.question,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      objectifCMC: questions.objectifCmc,
      domain: questions.domain,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
    .limit(1)
  if (!q) return null

  const [expl] = await db
    .select({
      explanation: questionExplanations.explanation,
      references: questionExplanations.references,
    })
    .from(questionExplanations)
    .where(eq(questionExplanations.questionId, id))
    .limit(1)

  // Deux jeux d'images séparés par `kind` (énoncé vs explication).
  const allImgs = await db
    .select({
      id: questionImages.id,
      storagePath: questionImages.storagePath,
      position: questionImages.position,
      kind: questionImages.kind,
    })
    .from(questionImages)
    .where(eq(questionImages.questionId, id))
    .orderBy(asc(questionImages.position))

  const images: QuestionImageView[] = []
  const explanationImages: QuestionImageView[] = []
  for (const img of allImgs) {
    const view = {
      id: img.id,
      storagePath: img.storagePath,
      position: img.position,
    }
    // Catégorisation explicite par kind : un éventuel futur 3e kind n'irait PAS
    // par défaut dans `images` (pont d'énoncé) — défense en profondeur anti-fuite.
    if (img.kind === "explanation") explanationImages.push(view)
    else if (img.kind === "statement") images.push(view)
  }

  return {
    id: q.id,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    objectifCMC: q.objectifCMC,
    domain: q.domain,
    createdAt: q.createdAt.getTime(),
    explanation: expl?.explanation ?? "",
    references: expl?.references ?? null,
    images,
    explanationImages,
  }
}

// ============================================
// [Admin] Objectifs CMC + ids (combobox, auto-complete)
// ============================================

/**
 * [Admin] Objectifs CMC distincts (combobox). Remplace `getUniqueObjectifsCMC`
 * (qui lisait la table d'agrégation `objectifCMCStats`) par un `SELECT DISTINCT`.
 * Tri français côté JS.
 */
export const getUniqueObjectifsCMC = async (): Promise<string[]> => {
  await requireRole(["admin"])
  const rows = await db
    .selectDistinct({ objectifCMC: questions.objectifCmc })
    .from(questions)
    .where(isNull(questions.deletedAt))
    .limit(2000)
  return rows.map((r) => r.objectifCMC).sort((a, b) => a.localeCompare(b, "fr"))
}

/** [Admin] Tous les ids de questions (auto-complete sélection examen). Borné. */
export const getAllQuestionIds = async (): Promise<string[]> => {
  await requireRole(["admin"])
  const rows = await db
    .select({ id: questions.id })
    .from(questions)
    .where(isNull(questions.deletedAt))
    .limit(5000)
  return rows.map((r) => r.id)
}

// ============================================
// [Public] Quiz marketing (sans auth)
// ============================================

export type QuizImageView = {
  url: string
  storagePath: string
  order: number
}

// Forme « pont » historique (`_id`/`_creationTime`/`images`) pour
// rester assignable à `Omit<Doc<"questions">, "correctAnswer" | "explanation">`
// — les composants quiz partagés (QuestionCard/QuizResults) consomment encore
// ce contrat tant que les écrans examen/entraînement ne sont pas migrés.
export type QuizQuestionView = {
  _id: string
  _creationTime: number
  question: string
  options: string[]
  objectifCMC: string
  domain: string
  images: QuizImageView[]
}

/**
 * [Public] Questions aléatoires pour le quiz d'évaluation marketing. Aucune
 * garde (page publique). Masque `correctAnswer` et `explanation` (renvoyés
 * seulement après soumission via la clé de correction). Exclut les questions
 * d'un examen OUVERT (`endDate` future) — anti-triche #91, l'exclusion vit dans
 * le WHERE pour que `ORDER BY random() LIMIT n` rende quand même n questions
 * corrigeables. Clamp `1..10` (le produit ne sert que 10). `ORDER BY random()`
 * suffit pour la banque (~3000 questions, hors chemin chaud). Images jointes
 * (URL CDN) pour l'affichage.
 */
export const getRandomQuizQuestions = async ({
  count,
  domain,
}: {
  count: number
  domain?: string
}): Promise<QuizQuestionView[]> => {
  const safeCount = clamp(count, 1, 10)
  const where = and(
    isNull(questions.deletedAt),
    // Anti-triche #91 : jamais de question d'un examen OUVERT dans le quiz
    // public. L'exclusion vit dans le WHERE (pas en post-filtrage) pour que
    // `ORDER BY random() LIMIT n` rende quand même n questions corrigeables.
    notExists(
      db
        .select({ x: sql`1` })
        .from(examQuestions)
        .innerJoin(exams, eq(exams.id, examQuestions.examId))
        .where(
          and(
            eq(examQuestions.questionId, questions.id),
            gt(exams.endDate, sql`now()`),
          ),
        ),
    ),
    domain && domain !== "all" ? eq(questions.domain, domain) : undefined,
  )

  const rows = await db
    .select({
      id: questions.id,
      question: questions.question,
      options: questions.options,
      objectifCMC: questions.objectifCmc,
      domain: questions.domain,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .where(where)
    .orderBy(sql`random()`)
    .limit(safeCount)
  if (rows.length === 0) return []

  const imgs = await db
    .select({
      questionId: questionImages.questionId,
      storagePath: questionImages.storagePath,
      position: questionImages.position,
    })
    .from(questionImages)
    .where(
      and(
        eq(questionImages.kind, "statement"),
        inArray(
          questionImages.questionId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .orderBy(asc(questionImages.position))

  const imgMap = new Map<string, QuizImageView[]>()
  for (const img of imgs) {
    const list = imgMap.get(img.questionId) ?? []
    list.push({
      url: cdnUrl(img.storagePath),
      storagePath: img.storagePath,
      order: img.position,
    })
    imgMap.set(img.questionId, list)
  }

  return rows.map((r) => ({
    _id: r.id,
    _creationTime: r.createdAt.getTime(),
    question: r.question,
    options: r.options,
    objectifCMC: r.objectifCMC,
    domain: r.domain,
    images: imgMap.get(r.id) ?? [],
  }))
}

export type QuizAnswerKey = {
  id: string
  correctAnswer: string
  explanation: string
  references: string[]
  explanationImages: QuizImageView[]
}

/**
 * Charge les images d'EXPLICATION (`kind='explanation'`) pour un lot d'ids,
 * groupées par question, URL CDN dérivée. Canal de révélation (correction) —
 * jamais sur le pont d'énoncé `images`. `Map` vide si aucun id.
 */
const fetchExplanationImages = async (
  questionIds: string[],
): Promise<Map<string, QuizImageView[]>> => {
  const map = new Map<string, QuizImageView[]>()
  if (questionIds.length === 0) return map
  const rows = await db
    .select({
      questionId: questionImages.questionId,
      storagePath: questionImages.storagePath,
      position: questionImages.position,
    })
    .from(questionImages)
    .where(
      and(
        eq(questionImages.kind, "explanation"),
        inArray(questionImages.questionId, questionIds),
      ),
    )
    .orderBy(asc(questionImages.position))
  for (const img of rows) {
    const list = map.get(img.questionId) ?? []
    list.push({
      url: cdnUrl(img.storagePath),
      storagePath: img.storagePath,
      order: img.position,
    })
    map.set(img.questionId, list)
  }
  return map
}

/**
 * [Public] Clé de correction (correctAnswer + explication + références + images
 * d'explication) pour un lot d'ids. Utilisée par le scoring du quiz APRÈS
 * soumission. Joint `questionExplanations`. Borné par l'appelant (longueur du quiz).
 */
export const getQuizAnswerKey = async (
  questionIds: string[],
): Promise<Map<string, QuizAnswerKey>> => {
  if (questionIds.length === 0) return new Map()

  const rows = await db
    .select({
      id: questions.id,
      correctAnswer: questions.correctAnswer,
      explanation: questionExplanations.explanation,
      references: questionExplanations.references,
    })
    .from(questions)
    .leftJoin(
      questionExplanations,
      eq(questionExplanations.questionId, questions.id),
    )
    .where(and(inArray(questions.id, questionIds), isNull(questions.deletedAt)))

  const explImgMap = await fetchExplanationImages(rows.map((r) => r.id))

  const map = new Map<string, QuizAnswerKey>()
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      correctAnswer: r.correctAnswer,
      explanation: r.explanation ?? "",
      references: r.references ?? [],
      explanationImages: explImgMap.get(r.id) ?? [],
    })
  }
  return map
}

// ============================================
// [Admin] Statistiques (agrégation SQL, remplace les tables d'agrégats)
// ============================================

export type DomainStat = { domain: string; count: number }

export type QuestionStats = {
  totalCount: number
  domainStats: DomainStat[]
}

export type QuestionStatsEnriched = {
  totalCount: number
  withImagesCount: number
  withoutImagesCount: number
  uniqueDomainsCount: number
  domainStats: DomainStat[]
}

const domainCounts = async (): Promise<DomainStat[]> => {
  const rows = await db
    .select({
      domain: questions.domain,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(questions)
    .where(isNull(questions.deletedAt))
    .groupBy(questions.domain)
  return rows
}

/** [Admin] Total + répartition par domaine (dashboard). Remplace `getQuestionStats`. */
export const getQuestionStats = async (): Promise<QuestionStats> => {
  await requireRole(["admin"])
  const domainStats = await domainCounts()
  const totalCount = domainStats.reduce((s, d) => s + d.count, 0)
  return { totalCount, domainStats }
}

/**
 * [Admin] Stats enrichies (page questions). Remplace `getQuestionStatsEnriched` :
 * total + avec/sans images + domaines uniques + répartition triée. `withImagesCount`
 * = nombre de questions (non supprimées) ayant ≥ 1 image (DISTINCT sur le join).
 */
export const getQuestionStatsEnriched =
  async (): Promise<QuestionStatsEnriched> => {
    await requireRole(["admin"])

    const [domainStats, withImagesRow] = await Promise.all([
      domainCounts(),
      db
        .select({
          n: sql<number>`count(distinct ${questionImages.questionId})`.mapWith(
            Number,
          ),
        })
        .from(questionImages)
        .innerJoin(
          questions,
          and(
            eq(questions.id, questionImages.questionId),
            isNull(questions.deletedAt),
          ),
        )
        // Scopé `statement` : `withImagesCount` = questions ayant ≥ 1 image d'énoncé.
        .where(eq(questionImages.kind, "statement")),
    ])

    const totalCount = domainStats.reduce((s, d) => s + d.count, 0)
    const withImagesCount = withImagesRow[0]?.n ?? 0
    const sorted = [...domainStats].sort((a, b) => b.count - a.count)

    return {
      totalCount,
      withImagesCount,
      withoutImagesCount: totalCount - withImagesCount,
      uniqueDomainsCount: domainStats.length,
      domainStats: sorted,
    }
  }

// ============================================
// [Admin] Export
// ============================================

export type QuestionExportRow = {
  id: string
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
  references: string[]
  objectifCMC: string
  domain: string
  hasImages: boolean
  imagesCount: number
  /** Epoch ms. */
  createdAt: number
}

/**
 * [Admin] Questions pour l'export (mêmes filtres que la liste, sans pagination —
 * borné à 5000). Joint l'explication ; compte les images en batch. Remplace
 * l'action `getAllQuestionsForExport` + sa boucle de pagination interne.
 */
export const getQuestionsForExport = async ({
  search,
  domain,
  hasImages,
}: {
  search?: string
  domain?: string
  hasImages?: boolean
} = {}): Promise<QuestionExportRow[]> => {
  await requireRole(["admin"])

  const searchTerm = search?.trim()
  const where = and(
    isNull(questions.deletedAt),
    domain && domain !== "all" ? eq(questions.domain, domain) : undefined,
    searchTerm
      ? or(
          ilike(questions.question, `%${escapeLike(searchTerm)}%`),
          ilike(questions.objectifCmc, `%${escapeLike(searchTerm)}%`),
        )
      : undefined,
    hasImages === undefined
      ? undefined
      : hasImages
        ? hasImagesSubquery
        : noImagesSubquery,
  )

  const rows = await db
    .select({
      id: questions.id,
      question: questions.question,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      objectifCMC: questions.objectifCmc,
      domain: questions.domain,
      createdAt: questions.createdAt,
      explanation: questionExplanations.explanation,
      references: questionExplanations.references,
    })
    .from(questions)
    .leftJoin(
      questionExplanations,
      eq(questionExplanations.questionId, questions.id),
    )
    .where(where)
    .orderBy(desc(questions.createdAt), desc(questions.id))
    .limit(5000)

  const counts = rows.length
    ? await db
        .select({
          questionId: questionImages.questionId,
          n: sql<number>`count(*)`.mapWith(Number),
        })
        .from(questionImages)
        .where(
          and(
            eq(questionImages.kind, "statement"),
            inArray(
              questionImages.questionId,
              rows.map((r) => r.id),
            ),
          ),
        )
        .groupBy(questionImages.questionId)
    : []
  const countMap = new Map(counts.map((c) => [c.questionId, c.n]))

  return rows.map((r) => {
    const imagesCount = countMap.get(r.id) ?? 0
    return {
      id: r.id,
      question: r.question,
      options: r.options,
      correctAnswer: r.correctAnswer,
      explanation: r.explanation ?? "",
      references: r.references ?? [],
      objectifCMC: r.objectifCMC,
      domain: r.domain,
      hasImages: imagesCount > 0,
      imagesCount,
      createdAt: r.createdAt.getTime(),
    }
  })
}
