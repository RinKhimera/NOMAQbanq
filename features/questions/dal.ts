import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  not,
  notExists,
  or,
  sql,
} from "drizzle-orm"
import "server-only"
import type { QuizImage, QuizQuestion } from "@/components/quiz/runner/types"
import { db } from "@/db"
import {
  examQuestions,
  exams,
  questionExplanations,
  questionImages,
  questions,
  user,
} from "@/db/schema"
import { requireRole } from "@/lib/auth-guards"
import { questionSuccessStats } from "../analytics/answers-sql"
import type { DomainDraw, DomainSupply } from "../exams/completion"
import { AnswerKeyLock, excludeLocked } from "./answer-key-lock"
import {
  KEY_CONFIRMATION_MIN_NEW_ANSWERS,
  type KeyConfirmation,
  keyReview,
} from "./key-review"
import { notUsedInLastExams } from "./last-use"
import { fetchImages, toQuizQuestion } from "./quiz-bridge"
import { RECENT_EXAMS_DEFAULT } from "./recent-exams"

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
// un examen ».
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

// Corrélation écrite qualifiée : dans un select mono-table, `${questions.id}`
// serait rendu `"id"` et viserait la table de la sous-requête.
const QUESTION_ID = sql`"questions"."id"`

// Une explication sans ligne, sans tableau ou avec un tableau vide n'a pas de
// références.
const noReferencesSubquery = sql`not exists (
  select 1
    from question_explanations nr
   where nr.question_id = ${QUESTION_ID}
     and jsonb_typeof(nr.references) = 'array'
     and jsonb_array_length(nr.references) > 0
)`

type BankStats = ReturnType<typeof questionSuccessStats>

/** Dernière confirmation de clé d'une ligne `questions`, ou `null`. */
const toKeyConfirmation = (row: {
  keyConfirmedAt: Date | null
  keyConfirmedAnswerCount: number | null
  keyConfirmedByName?: string | null
  keyConfirmedNote?: string | null
}): KeyConfirmation | null =>
  row.keyConfirmedAt && row.keyConfirmedAnswerCount !== null
    ? {
        at: row.keyConfirmedAt.getTime(),
        byName: row.keyConfirmedByName ?? null,
        answerCount: row.keyConfirmedAnswerCount,
        note: row.keyConfirmedNote ?? null,
      }
    : null

/**
 * Clé à vérifier, forme SQL de `keyReview` (`./key-review`) : clé suspecte
 * sans confirmation en vigueur. Les statistiques sont jointes en LEFT JOIN :
 * une question sans réponse n'est pas suspecte.
 */
const keyToVerifySql = (stats: BankStats) => sql<boolean>`(
  coalesce(${stats.keySuspect}, false)
  and (
    ${questions.keyConfirmedAt} is null
    or (
      ${stats.answerCount} >= 2 * ${questions.keyConfirmedAnswerCount}
      and ${stats.answerCount} - ${questions.keyConfirmedAnswerCount}
        >= ${KEY_CONFIRMATION_MIN_NEW_ANSWERS}
    )
  )
)`

// ============================================
// [Admin] Liste paginée + filtres
// ============================================

export type QuestionListItem = {
  id: string
  question: string
  domain: string
  objectifCMC: string
  options: string[]
  /** Epoch ms. */
  createdAt: number
  /** Epoch ms. */
  updatedAt: number
  imageCount: number
  /** Nombre d'examens référençant cette question. */
  usageCount: number
  /** Premières réponses d'étudiants comptées. */
  answerCount: number
  /** Taux de réussite en % ; `null` sous le seuil de signification. */
  successRate: number | null
  /** Clé à vérifier, confirmations en vigueur comprises. */
  keyToVerify: boolean
}

export type QuestionsPage = {
  items: QuestionListItem[]
  /** Total filtré (pagination numérotée). */
  total: number
}

export type QuestionSortBy =
  "createdAt" | "updatedAt" | "successRate" | "answerCount"

/** Tris de la banque du compositeur d'examen, en plus de ceux de la liste. */
export type BankSortBy =
  | QuestionSortBy
  /** Dernière utilisation, les plus anciennes (et jamais utilisées) d'abord. */
  | "lastUse"
  /** Domaine, puis dernière utilisation. */
  | "domain"

/** Les questions retenues par les filtres de la liste, que l'export reprend. */
export type QuestionSelection = {
  /** Énoncé, objectif, choix de réponse ou identifiant exact. */
  search?: string
  domain?: string
  objective?: string
  hasImages?: boolean
  /** Clé à vérifier. */
  toVerify?: boolean
  noReferences?: boolean
  usageFilter?: "all" | "used" | "unused"
  usedInExamId?: string
  /** Absente des N derniers examens blancs (dernière utilisation). */
  notUsedInLast?: number
  /** Hors du jeu de cet examen (banque du compositeur). */
  notInExamId?: string
}

export type QuestionFiltersInput = QuestionSelection & {
  /** 1-based. */
  page?: number
  limit?: number
  sortOrder?: "asc" | "desc"
  /** `successRate` : non significatives en fin, quel que soit le sens. */
  sortBy?: BankSortBy
}

/**
 * Prédicat des filtres sans statistiques ; `toVerify` se pose à part, sur
 * l'agrégat de la banque joint par l'appelant.
 */
const selectionWhere = ({
  search,
  domain,
  objective,
  hasImages,
  noReferences,
  usageFilter = "all",
  usedInExamId,
  notUsedInLast,
  notInExamId,
}: QuestionSelection) => {
  const searchTerm = search?.trim()
  const pattern = searchTerm ? `%${escapeLike(searchTerm)}%` : ""
  // `usedInExamId` prime sur used/unused (l'UI garantit l'exclusion mutuelle).
  const usagePredicate = usedInExamId
    ? usedInExamSubquery(usedInExamId)
    : usageFilter === "used"
      ? usedSubquery
      : usageFilter === "unused"
        ? unusedSubquery
        : undefined

  return and(
    isNull(questions.deletedAt),
    domain && domain !== "all" ? eq(questions.domain, domain) : undefined,
    objective ? eq(questions.objectifCmc, objective) : undefined,
    searchTerm
      ? or(
          ilike(questions.question, pattern),
          ilike(questions.objectifCmc, pattern),
          sql`exists (
            select 1
              from jsonb_array_elements_text("questions"."options") opt
             where opt ilike ${pattern}
          )`,
          eq(questions.id, searchTerm),
        )
      : undefined,
    hasImages === undefined
      ? undefined
      : hasImages
        ? hasImagesSubquery
        : noImagesSubquery,
    noReferences ? noReferencesSubquery : undefined,
    usagePredicate,
    notUsedInLast && notUsedInLast > 0
      ? notUsedInLastExams(
          clamp(notUsedInLast, 1, 50),
          QUESTION_ID,
          notInExamId,
        )
      : undefined,
    notInExamId ? not(usedInExamSubquery(notInExamId)) : undefined,
  )
}

const needsBankStats = (f: QuestionFiltersInput) =>
  f.sortBy === "successRate" || f.sortBy === "answerCount" || !!f.toVerify

/**
 * Date d'ouverture de la dernière utilisation (examens en préparation exclus,
 * voir `./last-use`), `null` pour une question jamais utilisée.
 */
const lastUseStart = sql`(
  select max(lu_e.start_date)
    from exam_questions lu_q
    join exams lu_e on lu_e.id = lu_q.exam_id
   where lu_q.question_id = ${QUESTION_ID}
     and lu_e.finalized_at is not null
)`

/**
 * Ordre de la liste, repris tel quel par les voisins précédent / suivant.
 * Départage final par id : deux pages ne se chevauchent jamais.
 */
const listOrder = (
  sortBy: BankSortBy,
  isDesc: boolean,
  stats: BankStats,
): SQL[] => {
  const dir = isDesc ? sql`desc` : sql`asc`
  switch (sortBy) {
    case "successRate":
      return [sql`${stats.successRate} ${dir} nulls last`, asc(questions.id)]
    case "answerCount":
      return [
        sql`coalesce(${stats.answerCount}, 0) ${dir}`,
        desc(questions.createdAt),
        asc(questions.id),
      ]
    case "lastUse":
      return [sql`${lastUseStart} ${dir} nulls first`, asc(questions.id)]
    case "domain":
      return [
        isDesc ? desc(questions.domain) : asc(questions.domain),
        sql`${lastUseStart} asc nulls first`,
        asc(questions.id),
      ]
    case "updatedAt":
      return isDesc
        ? [desc(questions.updatedAt), desc(questions.id)]
        : [asc(questions.updatedAt), asc(questions.id)]
    default:
      return isDesc
        ? [desc(questions.createdAt), desc(questions.id)]
        : [asc(questions.createdAt), asc(questions.id)]
  }
}

const listWhere = (f: QuestionFiltersInput, stats: BankStats) =>
  and(selectionWhere(f), f.toVerify ? keyToVerifySql(stats) : undefined)

const pageBounds = (f: QuestionFiltersInput) => {
  // `Number.isFinite` : un `page`/`limit` forgé (NaN/Infinity) ne doit pas
  // traverser le clamp (Math.max(1, NaN) === NaN → erreur SQL).
  const limit = clamp(Number.isFinite(f.limit) ? f.limit! : 50, 1, 100)
  const page =
    f.page !== undefined && Number.isFinite(f.page)
      ? Math.max(1, Math.floor(f.page))
      : 1
  return { limit, offset: (page - 1) * limit }
}

/** Une page de la liste, enrichie des comptes d'images, d'examens et des statistiques. */
const listPage = async (
  f: QuestionFiltersInput,
): Promise<QuestionListItem[]> => {
  const { limit, offset } = pageBounds(f)
  const bankStats = questionSuccessStats()
  const order = listOrder(
    f.sortBy ?? "createdAt",
    f.sortOrder !== "asc",
    bankStats,
  )
  const where = listWhere(f, bankStats)
  const columns = { id: questions.id }

  // L'agrégat de toute la banque n'est calculé que si le tri ou le filtre
  // en dépend.
  const rows = needsBankStats(f)
    ? await db
        .with(bankStats)
        .select(columns)
        .from(questions)
        .leftJoin(bankStats, eq(bankStats.questionId, questions.id))
        .where(where)
        .orderBy(...order)
        .limit(limit)
        .offset(offset)
    : await db
        .select(columns)
        .from(questions)
        .where(where)
        .orderBy(...order)
        .limit(limit)
        .offset(offset)

  return questionListItems(rows.map((r) => r.id))
}

/**
 * Lignes de liste de ces questions, dans l'ordre donné, enrichies des comptes
 * d'images, d'examens et des statistiques. Les ids inconnus sont ignorés.
 */
export const questionListItems = async (
  pageIds: string[],
): Promise<QuestionListItem[]> => {
  await requireRole(["admin"])
  if (pageIds.length === 0) return []

  const pageStats = questionSuccessStats(pageIds)
  const [details, imageCounts, usageCounts, statRows] = await Promise.all([
    db
      .select({
        id: questions.id,
        question: questions.question,
        domain: questions.domain,
        objectifCMC: questions.objectifCmc,
        options: questions.options,
        createdAt: questions.createdAt,
        updatedAt: questions.updatedAt,
        keyConfirmedAt: questions.keyConfirmedAt,
        keyConfirmedAnswerCount: questions.keyConfirmedAnswerCount,
      })
      .from(questions)
      .where(inArray(questions.id, pageIds)),
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
    db
      .with(pageStats)
      .select({
        questionId: pageStats.questionId,
        answerCount: pageStats.answerCount,
        successRate: pageStats.successRate,
        keySuspect: pageStats.keySuspect,
      })
      .from(pageStats),
  ])

  const detailMap = new Map(details.map((d) => [d.id, d]))
  const imageMap = new Map(imageCounts.map((c) => [c.questionId, c.n]))
  const usageMap = new Map(usageCounts.map((c) => [c.questionId, c.n]))
  const statMap = new Map(statRows.map((r) => [r.questionId, r]))

  return pageIds.flatMap((id) => {
    const d = detailMap.get(id)
    if (!d) return []
    const s = statMap.get(id)
    const answerCount = s?.answerCount ?? 0
    return [
      {
        id,
        question: d.question,
        domain: d.domain,
        objectifCMC: d.objectifCMC,
        options: d.options,
        createdAt: d.createdAt.getTime(),
        updatedAt: d.updatedAt.getTime(),
        imageCount: imageMap.get(id) ?? 0,
        usageCount: usageMap.get(id) ?? 0,
        answerCount,
        successRate: s?.successRate ?? null,
        keyToVerify: keyReview({
          answerCount,
          keySuspect: s?.keySuspect ?? false,
          confirmation: toKeyConfirmation(d),
        }).toVerify,
      },
    ]
  })
}

/**
 * [Admin] Questions filtrées + paginées (offset `page`/`limit` + `total`), pour
 * le navigateur de questions du formulaire d'examen. Garde admin.
 */
export const getQuestionsWithFilters = async (
  input: QuestionFiltersInput = {},
): Promise<QuestionsPage> => {
  await requireRole(["admin"])
  // Les clés à vérifier se parcourent d'abord par nombre de réponses : les
  // plus jouées pèsent le plus sur les scores.
  const filters: QuestionFiltersInput =
    input.toVerify && (input.sortBy ?? "createdAt") === "createdAt"
      ? { ...input, sortBy: "answerCount", sortOrder: "desc" }
      : input

  const countColumn = { n: sql<number>`count(*)`.mapWith(Number) }
  const bankStats = questionSuccessStats()
  const [items, totalRows] = await Promise.all([
    listPage(filters),
    // Le total ne dépend des statistiques que via le filtre « clé à vérifier ».
    filters.toVerify
      ? db
          .with(bankStats)
          .select(countColumn)
          .from(questions)
          .leftJoin(bankStats, eq(bankStats.questionId, questions.id))
          .where(listWhere(filters, bankStats))
      : db.select(countColumn).from(questions).where(selectionWhere(filters)),
  ])
  return { items, total: totalRows[0]?.n ?? 0 }
}

export type QuestionTabCounts = {
  all: number
  toVerify: number
  noReferences: number
}

/**
 * [Admin] Compteurs des onglets de la liste (Toutes, Clé à vérifier, Sans
 * références) sur la recherche et les filtres en cours : un seul passage sur
 * l'agrégat de la banque, coûteux sur Neon.
 */
export const getQuestionTabCounts = async (
  selection: Omit<QuestionSelection, "toVerify" | "noReferences">,
): Promise<QuestionTabCounts> => {
  await requireRole(["admin"])
  const bankStats = questionSuccessStats()
  const [row] = await db
    .with(bankStats)
    .select({
      all: sql<number>`count(*)`.mapWith(Number),
      toVerify:
        sql<number>`count(*) filter (where ${keyToVerifySql(bankStats)})`.mapWith(
          Number,
        ),
      noReferences:
        sql<number>`count(*) filter (where ${noReferencesSubquery})`.mapWith(
          Number,
        ),
    })
    .from(questions)
    .leftJoin(bankStats, eq(bankStats.questionId, questions.id))
    .where(
      selectionWhere({
        ...selection,
        toVerify: undefined,
        noReferences: undefined,
      }),
    )
  return {
    all: row?.all ?? 0,
    toVerify: row?.toVerify ?? 0,
    noReferences: row?.noReferences ?? 0,
  }
}

export type QuestionListPage = QuestionsPage & { counts: QuestionTabCounts }

/**
 * [Admin] Page de la liste des questions et compteurs de ses onglets. L'onglet
 * se pose par `toVerify` ou `noReferences` ; le total est le compteur de
 * l'onglet courant.
 */
export const getQuestionList = async (
  filters: QuestionFiltersInput,
): Promise<QuestionListPage> => {
  await requireRole(["admin"])
  const [counts, items] = await Promise.all([
    getQuestionTabCounts(filters),
    listPage(filters),
  ])
  const total = filters.toVerify
    ? counts.toVerify
    : filters.noReferences
      ? counts.noReferences
      : counts.all
  return { items, total, counts }
}

export type QuestionNeighbors = {
  /** 1-based. */
  position: number
  total: number
  previousId: string | null
  nextId: string | null
}

/**
 * [Admin] Place d'une question dans la liste filtrée et triée (mêmes filtres,
 * même ordre que la liste) et ses voisines, à travers les pages. `null` si la
 * question n'appartient pas à cette liste.
 */
export const getQuestionNeighbors = async (
  questionId: string,
  filters: QuestionFiltersInput,
): Promise<QuestionNeighbors | null> => {
  await requireRole(["admin"])

  const bankStats = questionSuccessStats()
  const order = sql.join(
    listOrder(
      filters.sortBy ?? "createdAt",
      filters.sortOrder !== "asc",
      bankStats,
    ),
    sql`, `,
  )
  const columns = {
    rankedId: sql<string>`${questions.id}`.as("r_id"),
    position: sql<number>`row_number() over (order by ${order})`
      .mapWith(Number)
      .as("r_position"),
    previousId: sql<
      string | null
    >`lag(${questions.id}) over (order by ${order})`.as("r_previous"),
    nextId: sql<
      string | null
    >`lead(${questions.id}) over (order by ${order})`.as("r_next"),
    total: sql<number>`count(*) over ()`.mapWith(Number).as("r_total"),
  }
  // L'agrégat de la banque n'est joint que si l'ordre ou l'onglet en dépend :
  // chaque ouverture du détail rejoue cette requête.
  const ranked = needsBankStats(filters)
    ? db
        .$with("ranked")
        .as(
          db
            .with(bankStats)
            .select(columns)
            .from(questions)
            .leftJoin(bankStats, eq(bankStats.questionId, questions.id))
            .where(listWhere(filters, bankStats)),
        )
    : db
        .$with("ranked")
        .as(
          db
            .select(columns)
            .from(questions)
            .where(listWhere(filters, bankStats)),
        )
  const [row] = await db
    .with(ranked)
    .select()
    .from(ranked)
    .where(eq(ranked.rankedId, questionId))
    .limit(1)
  if (!row) return null
  return {
    position: Number(row.position),
    total: Number(row.total),
    previousId: row.previousId,
    nextId: row.nextId,
  }
}

// ============================================
// [Admin] Question complète (détail + édition)
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
  /** Epoch ms. */
  updatedAt: number
  explanation: string
  references: string[] | null
  /** Images d'énoncé (`kind='statement'`). */
  images: QuestionImageView[]
  /** Images d'explication (`kind='explanation'`), affichées à la correction. */
  explanationImages: QuestionImageView[]
  /** Dernière confirmation de la clé, en vigueur ou non. */
  keyConfirmation: KeyConfirmation | null
}

/**
 * [Admin] Question par id, jointe à son explication (1:1), ses images (enfant,
 * triées) et sa dernière confirmation de clé. `null` si introuvable ou
 * supprimée.
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
      updatedAt: questions.updatedAt,
      keyConfirmedAt: questions.keyConfirmedAt,
      keyConfirmedAnswerCount: questions.keyConfirmedAnswerCount,
      keyConfirmedNote: questions.keyConfirmedNote,
      keyConfirmedByName: user.name,
      explanation: questionExplanations.explanation,
      references: questionExplanations.references,
    })
    .from(questions)
    .leftJoin(user, eq(user.id, questions.keyConfirmedBy))
    .leftJoin(
      questionExplanations,
      eq(questionExplanations.questionId, questions.id),
    )
    .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
    .limit(1)
  if (!q) return null

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
    updatedAt: q.updatedAt.getTime(),
    explanation: q.explanation ?? "",
    references: q.references ?? null,
    images,
    explanationImages,
    keyConfirmation: toKeyConfirmation(q),
  }
}

export type QuestionExamUse = {
  id: string
  title: string
  /** Epoch ms ; `null` pour un examen en préparation sans dates. */
  startDate: number | null
  endDate: number | null
  /** Epoch ms ; `null` = examen en préparation. */
  finalizedAt: number | null
  isActive: boolean
}

/** Au-delà, la fiche n'affiche plus les examens d'une question. */
const QUESTION_EXAMS_LIMIT = 100

/**
 * [Admin] Examens blancs dont le lot contient la question, du plus récent au
 * plus ancien par date d'ouverture. Borné.
 */
export const getQuestionExams = async (
  questionId: string,
): Promise<QuestionExamUse[]> => {
  await requireRole(["admin"])
  const rows = await db
    .select({
      id: exams.id,
      title: exams.title,
      startDate: exams.startDate,
      endDate: exams.endDate,
      finalizedAt: exams.finalizedAt,
      isActive: exams.isActive,
    })
    .from(examQuestions)
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
    .where(eq(examQuestions.questionId, questionId))
    .orderBy(desc(exams.startDate), desc(exams.id))
    .limit(QUESTION_EXAMS_LIMIT)
  return rows.map((r) => ({
    ...r,
    startDate: r.startDate?.getTime() ?? null,
    endDate: r.endDate?.getTime() ?? null,
    finalizedAt: r.finalizedAt?.getTime() ?? null,
  }))
}

// ============================================
// [Admin] Banque du compositeur d'examen
// ============================================

/** Dernière utilisation d'une question (`CONTEXT.md`). */
export type LastUse = {
  examId: string
  title: string
  /** Epoch ms : un examen finalisé a toujours ses dates. */
  startDate: number
  /** Dans l'un des derniers examens blancs : question récente. */
  recent: boolean
}

export type BankQuestion = QuestionListItem & {
  lastUse: LastUse | null
  /** Supprimée depuis son ajout au jeu : la finalisation la refuse. */
  deleted: boolean
}

/** Question récente (`CONTEXT.md`), forme SQL corrélée sur `questions`. */
const recentSql = (examId: string) =>
  sql<boolean>`not ${notUsedInLastExams(RECENT_EXAMS_DEFAULT, QUESTION_ID, examId)}`

/**
 * [Admin] Dernière utilisation de chaque question : l'examen le plus récent
 * par date d'ouverture qui la contient, désactivés compris, examens en
 * préparation exclus (même ordre que `notUsedInLastExams`). Une question est
 * récente quand cet examen est l'un des derniers examens blancs.
 * `exceptExamId` : l'examen qu'on compose ne compte pas pour ses propres
 * questions, même finalisé (sinon elles seraient toutes récentes).
 */
export const getLastUses = async (
  questionIds: string[],
  exceptExamId?: string,
): Promise<Map<string, LastUse>> => {
  await requireRole(["admin"])
  if (questionIds.length === 0) return new Map()
  const [rows, recentExams] = await Promise.all([
    db
      .selectDistinctOn([examQuestions.questionId], {
        questionId: examQuestions.questionId,
        examId: exams.id,
        title: exams.title,
        startDate: exams.startDate,
      })
      .from(examQuestions)
      .innerJoin(exams, eq(exams.id, examQuestions.examId))
      .where(
        and(
          inArray(examQuestions.questionId, questionIds),
          isNotNull(exams.finalizedAt),
          exceptExamId ? ne(exams.id, exceptExamId) : undefined,
        ),
      )
      .orderBy(examQuestions.questionId, desc(exams.startDate), desc(exams.id)),
    db
      .select({ id: exams.id })
      .from(exams)
      .where(
        and(
          isNotNull(exams.finalizedAt),
          exceptExamId ? ne(exams.id, exceptExamId) : undefined,
        ),
      )
      .orderBy(desc(exams.startDate), desc(exams.id))
      .limit(RECENT_EXAMS_DEFAULT),
  ])
  const recent = new Set(recentExams.map((e) => e.id))
  return new Map(
    rows.flatMap((r) =>
      r.startDate
        ? [
            [
              r.questionId,
              {
                examId: r.examId,
                title: r.title,
                startDate: r.startDate.getTime(),
                recent: recent.has(r.examId),
              },
            ],
          ]
        : [],
    ),
  )
}

const withLastUses = async (
  items: QuestionListItem[],
  examId: string,
  deleted: ReadonlySet<string> = new Set(),
): Promise<BankQuestion[]> => {
  const lastUses = await getLastUses(
    items.map((i) => i.id),
    examId,
  )
  return items.map((i) => ({
    ...i,
    lastUse: lastUses.get(i.id) ?? null,
    deleted: deleted.has(i.id),
  }))
}

/** Questions par page de la banque du compositeur. */
export const BANK_PAGE_SIZE = 20

export type BankFilters = Pick<
  QuestionSelection,
  "search" | "domain" | "notUsedInLast"
> & {
  sortBy: "lastUse" | "domain" | "successRate"
  /** 1-based. */
  page: number
}

/**
 * [Admin] Une page de la banque du compositeur : les questions hors du jeu de
 * l'examen, avec leur dernière utilisation. Plus anciennes d'abord, plus
 * faible réussite d'abord.
 */
export const getExamBank = async (
  examId: string,
  filters: BankFilters,
): Promise<{ items: BankQuestion[]; total: number }> => {
  await requireRole(["admin"])
  const page = await getQuestionsWithFilters({
    ...filters,
    notInExamId: examId,
    sortOrder: "asc",
    limit: BANK_PAGE_SIZE,
  })
  return { items: await withLastUses(page.items, examId), total: page.total }
}

/** [Admin] Le jeu de questions d'un examen, avec leur dernière utilisation. */
export const getExamSelection = async (
  examId: string,
): Promise<BankQuestion[]> => {
  await requireRole(["admin"])
  const rows = await db
    .select({ id: examQuestions.questionId, deletedAt: questions.deletedAt })
    .from(examQuestions)
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position))
    .limit(1000)
  return withLastUses(
    await questionListItems(rows.map((r) => r.id)),
    examId,
    new Set(rows.filter((r) => r.deletedAt).map((r) => r.id)),
  )
}

export type DomainPlanRow = {
  domain: string
  /** Dans le jeu de l'examen. */
  chosen: number
  /** Dans la banque, hors du jeu. */
  available: number
  /** Disponibles et récentes. */
  recent: number
}

/** [Admin] Plan par domaine du compositeur : choisies, disponibles, récentes. */
export const getDomainPlan = async (
  examId: string,
): Promise<DomainPlanRow[]> => {
  await requireRole(["admin"])
  const inExam = usedInExamSubquery(examId)
  const recent = recentSql(examId)
  return (
    db
      .select({
        domain: questions.domain,
        chosen: sql<number>`count(*) filter (where ${inExam})`.mapWith(Number),
        available: sql<number>`count(*) filter (where not ${inExam})`.mapWith(
          Number,
        ),
        recent:
          sql<number>`count(*) filter (where not ${inExam} and ${recent})`.mapWith(
            Number,
          ),
      })
      .from(questions)
      // Une question supprimée reste comptée dans le jeu qui la contient.
      .where(or(isNull(questions.deletedAt), inExam))
      .groupBy(questions.domain)
      .orderBy(asc(questions.domain))
      .limit(100)
  )
}

/** Questions tirables par la complétion : hors du jeu, non supprimées, clé sans doute. */
const drawablePool = (examId: string, stats: BankStats) =>
  and(
    isNull(questions.deletedAt),
    not(usedInExamSubquery(examId)),
    not(keyToVerifySql(stats)),
  )

/**
 * [Admin] Offre de la banque par domaine pour la complétion (voir
 * `planCompletion`) : toutes les disponibles fixent la répartition, les clés à
 * vérifier ne sont jamais tirées.
 */
export const getBankSupply = async (
  examId: string,
): Promise<DomainSupply[]> => {
  await requireRole(["admin"])
  const stats = questionSuccessStats()
  const usable = sql`not ${keyToVerifySql(stats)}`
  const recent = recentSql(examId)
  return db
    .with(stats)
    .select({
      domain: questions.domain,
      available: sql<number>`count(*)`.mapWith(Number),
      clean:
        sql<number>`count(*) filter (where ${usable} and not ${recent})`.mapWith(
          Number,
        ),
      recent:
        sql<number>`count(*) filter (where ${usable} and ${recent})`.mapWith(
          Number,
        ),
    })
    .from(questions)
    .leftJoin(stats, eq(stats.questionId, questions.id))
    .where(and(isNull(questions.deletedAt), not(usedInExamSubquery(examId))))
    .groupBy(questions.domain)
    .limit(100)
}

/** Une complétion ne dépasse jamais le plus grand jeu possible. */
const MAX_DRAW = 1000

/**
 * [Admin] Tire au hasard, dans chaque domaine, le nombre d'anciennes et de
 * récentes demandé, parmi les questions tirables.
 */
export const drawFromBank = async (
  examId: string,
  draws: DomainDraw[],
): Promise<{ id: string; domain: string; recent: boolean }[]> => {
  await requireRole(["admin"])
  if (draws.length === 0) return []
  const stats = questionSuccessStats()
  const recent = recentSql(examId)
  const pool = db.$with("pool").as(
    db
      .with(stats)
      .select({
        id: sql<string>`${questions.id}`.as("p_id"),
        domain: sql<string>`${questions.domain}`.as("p_domain"),
        recent: sql<boolean>`${recent}`.as("p_recent"),
        rank: sql<number>`row_number() over (partition by ${questions.domain}, ${recent} order by random())`.as(
          "p_rank",
        ),
      })
      .from(questions)
      .leftJoin(stats, eq(stats.questionId, questions.id))
      .where(drawablePool(examId, stats)),
  )
  const quotas = sql.join(
    draws.map((d) => sql`(${d.domain}, ${d.clean}::int, ${d.fallback}::int)`),
    sql`, `,
  )
  const rows = await db
    .with(pool)
    .select({ id: pool.id, domain: pool.domain, recent: pool.recent })
    .from(pool)
    .innerJoin(
      sql`(values ${quotas}) as quota(domain, clean, fallback)`,
      sql`quota.domain = ${pool.domain}`,
    )
    .where(
      sql`${pool.rank} <= case when ${pool.recent} then quota.fallback else quota.clean end`,
    )
    .limit(MAX_DRAW)
  return rows
}

// ============================================
// [Admin] Objectifs CMC + ids (combobox, auto-complete)
// ============================================

/**
 * [Admin] Objectifs du CMC de chaque domaine : ceux qu'utilise au moins une
 * question active du domaine, triés en français. Seule lecture des objectifs
 * (filtre de la liste, combobox du formulaire) : elle basculera sur le
 * référentiel des objectifs sans toucher aux écrans.
 */
export const getObjectivesByDomain = async (): Promise<
  Record<string, string[]>
> => {
  await requireRole(["admin"])
  const rows = await db
    .selectDistinct({
      domain: questions.domain,
      objective: questions.objectifCmc,
    })
    .from(questions)
    .where(isNull(questions.deletedAt))
    .limit(5000)
  const byDomain: Record<string, string[]> = {}
  for (const r of rows) (byDomain[r.domain] ??= []).push(r.objective)
  for (const list of Object.values(byDomain))
    list.sort((a, b) => a.localeCompare(b, "fr"))
  return byDomain
}

// ============================================
// [Public] Quiz marketing (sans auth)
// ============================================

/**
 * [Public] Questions aléatoires pour le quiz d'évaluation marketing. Aucune
 * garde (page publique). Masque `correctAnswer` et `explanation` (renvoyés
 * seulement après soumission via la clé de correction). Exclut les questions
 * d'un examen OUVERT (`endDate` future) — anti-triche, l'exclusion vit dans
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
}): Promise<QuizQuestion[]> => {
  const safeCount = clamp(count, 1, 10)
  const where = and(
    isNull(questions.deletedAt),
    // Anti-triche : jamais de question d'un examen OUVERT dans le quiz
    // public. L'exclusion vit dans le WHERE (pas en post-filtrage) pour que
    // `ORDER BY random() LIMIT n` rende quand même n questions corrigeables.
    excludeLocked("anonymous", sql`${questions.id}`),
    domain && domain !== "all" ? eq(questions.domain, domain) : undefined,
  )

  const rows = await db
    .select({
      questionId: questions.id,
      question: questions.question,
      options: questions.options,
      objectifCMC: questions.objectifCmc,
      domain: questions.domain,
    })
    .from(questions)
    .where(where)
    .orderBy(sql`random()`)
    .limit(safeCount)
  if (rows.length === 0) return []

  const imgMap = await fetchImages(rows.map((r) => r.questionId))
  return rows.map((r) =>
    toQuizQuestion(
      r,
      imgMap.get(r.questionId) ?? [],
      AnswerKeyLock.none(),
      null,
    ),
  )
}

export type QuizAnswerKey = {
  id: string
  correctAnswer: string
  explanation: string
  references: string[]
  explanationImages: QuizImage[]
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

  const explImgMap = await fetchImages(
    rows.map((r) => r.id),
    "explanation",
  )

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
  /** Premières réponses d'étudiants comptées. */
  answerCount: number
  /** Taux de réussite en % ; `null` sous le seuil de signification. */
  successRate: number | null
}

/**
 * [Admin] Questions pour l'export : la sélection de la liste, sans pagination
 * (borné à 5000), avec l'explication et le taux de
 * réussite. L'agrégat couvre toute la banque, comme l'onglet « Clé à
 * vérifier » de la liste.
 */
export const getQuestionsForExport = async (
  selection: QuestionSelection = {},
): Promise<QuestionExportRow[]> => {
  await requireRole(["admin"])

  const bankStats = questionSuccessStats()
  const rows = await db
    .with(bankStats)
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
      answerCount: bankStats.answerCount,
      successRate: bankStats.successRate,
    })
    .from(questions)
    .leftJoin(
      questionExplanations,
      eq(questionExplanations.questionId, questions.id),
    )
    .leftJoin(bankStats, eq(bankStats.questionId, questions.id))
    .where(
      and(
        selectionWhere(selection),
        selection.toVerify ? keyToVerifySql(bankStats) : undefined,
      ),
    )
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
      answerCount: r.answerCount ?? 0,
      successRate: r.successRate,
    }
  })
}
