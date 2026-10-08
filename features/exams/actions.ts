"use server"

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { randomInt } from "node:crypto"
import { db } from "@/db"
import {
  examAnswers,
  examAudience,
  examParticipations,
  examQuestions,
  exams,
  questions,
  user,
} from "@/db/schema"
import { pauseCredit } from "@/lib/attempt-clock"
import { requireRole, requireSession } from "@/lib/auth-guards"
import { isOpen } from "@/lib/exam-phase"
import { createId } from "@/lib/ids"
import { captureServerError } from "@/lib/observability"
import { OPTION_CHANGED, optionChanged } from "../attempts/answer-refusal"
import { closeAttempts } from "../attempts/close"
import {
  type Refusal,
  type RefusalCode,
  refusalMessage,
  requireAttempt,
} from "../attempts/guard"
import { hasActiveAccess } from "../payments/dal"
import { viewerOf } from "../questions/answer-key-lock"
import { drawFromBank, getBankSupply } from "../questions/dal"
import { type SelectableUser, searchSelectableUsers } from "../users/dal"
import { completionLines, planCompletion } from "./completion"
import {
  type QuestionExplanationView,
  getExamQuestionExplanations,
  getRemainingSeats,
} from "./dal"
import {
  DEFAULT_PAUSE_MINUTES,
  type ExamAudienceType,
  type FinalizeExamInput,
  MAX_PAUSE_MINUTES,
  SECONDS_PER_QUESTION,
  type SaveExamAnswerInput,
  type SaveExamFlagInput,
  type SaveExamInput,
  composeQuestionsSchema,
  deleteExamSchema,
  examIdSchema,
  finalizeExamSchema,
  loadExamQuestionExplanationsSchema,
  saveExamAnswerSchema,
  saveExamFlagSchema,
  saveExamSchema,
} from "./schemas"

const fail = (error: string) => ({ success: false as const, error })

const resolvePause = (enablePause: boolean, minutes?: number) => {
  if (!enablePause) return null
  return Math.min(minutes ?? DEFAULT_PAUSE_MINUTES, MAX_PAUSE_MINUTES)
}

// ============================================
// Lectures (wrappers composants clients)
// ============================================

/** [Auth] Explications à la demande (déplier une question — résultats). */
export const loadExamQuestionExplanations = async (
  questionIds: string[],
): Promise<QuestionExplanationView[]> => {
  await requireSession()
  const parsed = loadExamQuestionExplanationsSchema.safeParse(questionIds)
  if (!parsed.success) return []
  return getExamQuestionExplanations(parsed.data)
}

/** [Admin] Recherche serveur d'utilisateurs sélectionnables (picker d'audience). */
export const loadSearchSelectableUsers = async (params: {
  query?: string
  limit?: number
}): Promise<SelectableUser[]> => {
  await requireRole(["admin"])
  return searchSelectableUsers(params)
}

// ============================================
// Admin : CRUD examens
// ============================================

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Champs du formulaire d'examen qu'un refus peut viser. */
export type ExamField =
  | "title"
  | "targetQuestionCount"
  | "questionIds"
  | "startDate"
  | "endDate"
  | "audienceUserIds"

export type ExamFieldErrors = Partial<Record<ExamField, string>>

type ExamWriteFailure = {
  success: false
  error: string
  /** Un message par champ fautif (finalisation, examen qui reste finalisé). */
  fieldErrors?: ExamFieldErrors
}

/** Refus de validation par champ, levé dans la transaction pour l'annuler. */
class ExamInvalid extends Error {
  constructor(readonly fieldErrors: ExamFieldErrors) {
    super("EXAM_INVALID")
  }
}

const EXAM_ERRORS: Record<string, string> = {
  NOT_FOUND: "Examen introuvable.",
  ALREADY_FINALIZED: "Cet examen est déjà finalisé.",
  HAS_PARTICIPATIONS:
    "Cet examen a déjà des participations ; ses questions ne peuvent plus être modifiées.",
  REOPEN_BY_DATES:
    "Cet examen est clos et a déjà des participations : sa date de fin ne peut plus être repoussée dans le futur. Utilisez « Rouvrir » pour en créer une copie avec de nouvelles dates.",
  INVALID_QUESTIONS: "Certaines questions sélectionnées sont introuvables.",
  INVALID_USERS: "Certains utilisateurs sélectionnés sont introuvables.",
}

/** Erreur métier mappée en message, sinon capture et message générique. */
const examWriteFailure = (
  error: unknown,
  tag: string,
  userId: string,
): ExamWriteFailure => {
  if (error instanceof ExamInvalid) {
    return {
      success: false,
      error: Object.values(error.fieldErrors)[0] ?? "Données invalides",
      fieldErrors: error.fieldErrors,
    }
  }
  if (error instanceof Error && error.message in EXAM_ERRORS) {
    return fail(EXAM_ERRORS[error.message])
  }
  captureServerError(tag, error, { userId })
  return fail("Erreur serveur. Réessayez.")
}

const lockExam = async (tx: Tx, examId: string) => {
  // Verrou de ligne examen : commun avec startExam → sérialise l'écriture du
  // jeu de questions, la finalisation et le démarrage d'une participation
  // (sinon un count de participations peut lire 0 avant qu'un startExam
  // concurrent ne commite la sienne).
  const [exam] = await tx
    .select({
      finalizedAt: exams.finalizedAt,
      endDate: exams.endDate,
      targetQuestionCount: exams.targetQuestionCount,
    })
    .from(exams)
    .where(eq(exams.id, examId))
    .for("update")
    .limit(1)
  if (!exam) throw new Error("NOT_FOUND")
  return exam
}

const hasParticipationsTx = async (tx: Tx, examId: string) => {
  const [row] = await tx
    .select({ id: examParticipations.id })
    .from(examParticipations)
    .where(eq(examParticipations.examId, examId))
    .limit(1)
  return Boolean(row)
}

const examQuestionIds = async (tx: Tx, examId: string) => {
  const rows = await tx
    .select({ questionId: examQuestions.questionId })
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position))
  return rows.map((r) => r.questionId)
}

/** Questions ajoutées au jeu : elles doivent exister, non supprimées. */
const assertQuestionsExist = async (tx: Tx, ids: string[]) => {
  if (ids.length === 0) return
  const [valid] = await tx
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(questions)
    .where(and(inArray(questions.id, ids), isNull(questions.deletedAt)))
  if ((valid?.n ?? 0) !== ids.length) throw new Error("INVALID_QUESTIONS")
}

/** Remplace le jeu, dans l'ordre donné. */
const writeQuestions = async (tx: Tx, examId: string, ids: string[]) => {
  await tx.delete(examQuestions).where(eq(examQuestions.examId, examId))
  if (ids.length === 0) return
  await tx
    .insert(examQuestions)
    .values(
      ids.map((questionId, position) => ({ examId, questionId, position })),
    )
}

/**
 * Audience éditable à tout moment, indépendamment des participations (jamais
 * touchées) : vidée puis réinsérée dédupliquée si restreinte.
 */
const writeAudience = async (
  tx: Tx,
  examId: string,
  audienceType: ExamAudienceType,
  userIds: string[],
) => {
  await tx.delete(examAudience).where(eq(examAudience.examId, examId))
  if (audienceType !== "restricted") return
  const uniqueIds = [...new Set(userIds)]
  if (uniqueIds.length === 0) return
  const validUsers = await tx
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, uniqueIds), isNull(user.deletedAt)))
  if (validUsers.length !== uniqueIds.length) throw new Error("INVALID_USERS")
  await tx
    .insert(examAudience)
    .values(uniqueIds.map((userId) => ({ examId, userId })))
}

const sameSet = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

const shuffled = <T>(items: T[]): T[] => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Ce qu'un examen finalisé exige de ses dates et de son audience. */
const datesAndAudienceErrors = (d: {
  startDate: number | null
  endDate: number | null
  audienceType: ExamAudienceType
  audienceSize: number
}): ExamFieldErrors => {
  const errors: ExamFieldErrors = {}
  if (d.startDate === null) errors.startDate = "Date d'ouverture requise"
  if (d.endDate === null) errors.endDate = "Date de fermeture requise"
  else if (d.startDate !== null && d.endDate <= d.startDate) {
    errors.endDate = "La date de fin doit être postérieure à la date de début"
  }
  if (d.audienceType === "restricted" && d.audienceSize === 0) {
    errors.audienceUserIds = "Sélectionnez au moins un utilisateur"
  }
  return errors
}

/**
 * Finalisation (`CONTEXT.md`), sous le verrou de l'examen pris par
 * l'appelant : validation complète avec un message par champ, durée fixée sur
 * le jeu réel, ordre des questions mélangé puis figé. Une ouverture passée
 * avec une fin à venir est acceptée : l'examen s'ouvre aussitôt.
 */
const finalizeInTx = async (tx: Tx, examId: string, now: number) => {
  // En séquence : une transaction tient une seule connexion, qui n'exécute
  // qu'une requête à la fois (pg@9 refuse d'empiler).
  const [exam] = await tx
    .select({
      startDate: exams.startDate,
      endDate: exams.endDate,
      audienceType: exams.audienceType,
      targetQuestionCount: exams.targetQuestionCount,
    })
    .from(exams)
    .where(eq(exams.id, examId))
    .limit(1)
  const set = await tx
    .select({
      questionId: examQuestions.questionId,
      deletedAt: questions.deletedAt,
    })
    .from(examQuestions)
    .innerJoin(questions, eq(questions.id, examQuestions.questionId))
    .where(eq(examQuestions.examId, examId))
  const [audience] = await tx
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(examAudience)
    .innerJoin(user, eq(user.id, examAudience.userId))
    .where(and(eq(examAudience.examId, examId), isNull(user.deletedAt)))
  if (!exam) throw new Error("NOT_FOUND")

  const startDate = exam.startDate?.getTime() ?? null
  const endDate = exam.endDate?.getTime() ?? null
  const errors = datesAndAudienceErrors({
    startDate,
    endDate,
    audienceType: exam.audienceType,
    audienceSize: audience?.n ?? 0,
  })
  if (!errors.endDate && endDate !== null && !isOpen({ endDate }, now)) {
    errors.endDate = "La fenêtre est déjà close : décalez les dates."
  }
  // Pas de doublon possible : la clé primaire (exam_id, question_id) l'exclut.
  if (set.some((q) => q.deletedAt !== null)) {
    errors.questionIds =
      "Le jeu contient des questions supprimées : retirez-les avant de finaliser."
  } else if (set.length !== exam.targetQuestionCount) {
    errors.questionIds = `Le jeu compte ${set.length} questions sur ${exam.targetQuestionCount} visées.`
  }
  if (Object.keys(errors).length > 0) throw new ExamInvalid(errors)

  await writeQuestions(tx, examId, shuffled(set.map((q) => q.questionId)))
  await tx
    .update(exams)
    .set({
      finalizedAt: new Date(now),
      completionTime: set.length * SECONDS_PER_QUESTION,
    })
    .where(eq(exams.id, examId))
}

type ExamSettings = {
  title: string
  description?: string
  targetQuestionCount: number
  startDate: number | null
  endDate: number | null
  questionIds?: string[]
  enablePause: boolean
  pauseDurationMinutes?: number
  audienceType: ExamAudienceType
  audienceUserIds: string[]
}

const settingsColumns = (s: ExamSettings) => ({
  title: s.title,
  description: s.description ?? null,
  targetQuestionCount: s.targetQuestionCount,
  startDate: s.startDate === null ? null : new Date(s.startDate),
  endDate: s.endDate === null ? null : new Date(s.endDate),
  enablePause: s.enablePause,
  pauseDurationMinutes: resolvePause(s.enablePause, s.pauseDurationMinutes),
  audienceType: s.audienceType,
})

/** Crée un examen en préparation. */
const insertExamTx = async (
  tx: Tx,
  s: ExamSettings,
  createdBy: string,
): Promise<string> => {
  const examId = createId()
  const ids = s.questionIds ?? []
  await assertQuestionsExist(tx, ids)
  await tx.insert(exams).values({
    id: examId,
    ...settingsColumns(s),
    finalizedAt: null,
    completionTime: null,
    createdBy,
  })
  await writeQuestions(tx, examId, ids)
  await writeAudience(tx, examId, s.audienceType, s.audienceUserIds)
  return examId
}

/**
 * Enregistre un examen existant et dit s'il reste finalisé. Changer son jeu ou
 * son nombre visé le remet en préparation (il doit être refinalisé, ordre
 * remélangé) ; c'est refusé dès la première participation. Ses autres réglages
 * ne lui retirent pas sa finalisation, mais un examen qui la garde est validé
 * en entier.
 */
const updateExamTx = async (
  tx: Tx,
  examId: string,
  s: ExamSettings,
  now: number,
): Promise<{ finalized: boolean }> => {
  const exam = await lockExam(tx, examId)
  const hasParticipations = await hasParticipationsTx(tx, examId)
  const current = await examQuestionIds(tx, examId)
  const next = s.questionIds ?? current
  const setChanged = !sameSet(current, next)
  // Un visé ramené à la taille du jeu n'en change pas la définition : c'est
  // le recalage d'un examen inséré sans visé (défaut 0, `db/schema/exams.ts`).
  const targetChanged =
    s.targetQuestionCount !== exam.targetQuestionCount &&
    s.targetQuestionCount !== next.length

  // Rouvrir par les dates rendrait l'examen de nouveau ouvert pour ses
  // anciens participants : verrou de clé sur leurs autres examens, résultats
  // masqués, reprise impossible (une participation par étudiant). Avant la
  // garde des questions : c'est ce refus qui dit quoi faire (« Rouvrir »).
  if (
    hasParticipations &&
    exam.endDate &&
    !isOpen({ endDate: exam.endDate.getTime() }, now) &&
    s.endDate !== null &&
    isOpen({ endDate: s.endDate }, now)
  ) {
    throw new Error("REOPEN_BY_DATES")
  }
  // Le jeu se fige à la première participation : le changer fausserait les
  // scores déjà calculés.
  if (hasParticipations && (setChanged || targetChanged)) {
    throw new Error("HAS_PARTICIPATIONS")
  }
  if (next.length > s.targetQuestionCount) {
    throw new ExamInvalid({
      targetQuestionCount: `Le nombre visé ne peut pas descendre sous les ${next.length} questions déjà choisies.`,
    })
  }

  const finalized = exam.finalizedAt !== null && !setChanged && !targetChanged
  if (finalized) {
    const errors = datesAndAudienceErrors({
      ...s,
      audienceSize: new Set(s.audienceUserIds).size,
    })
    if (Object.keys(errors).length > 0) throw new ExamInvalid(errors)
  }

  if (setChanged) {
    const known = new Set(current)
    await assertQuestionsExist(
      tx,
      next.filter((id) => !known.has(id)),
    )
    await writeQuestions(tx, examId, next)
  }
  await tx
    .update(exams)
    .set({
      ...settingsColumns(s),
      ...(!finalized && { finalizedAt: null, completionTime: null }),
    })
    .where(eq(exams.id, examId))
  await writeAudience(tx, examId, s.audienceType, s.audienceUserIds)
  return { finalized }
}

const revalidateExam = (examId: string) => {
  revalidatePath("/admin/examens")
  revalidatePath(`/admin/examens/${examId}`)
}

export type SaveExamResult =
  { success: true; examId: string; finalized: boolean } | ExamWriteFailure

/**
 * [Admin] « Enregistrer » : crée un examen en préparation, ou enregistre un
 * examen existant (voir `updateExamTx`). Titre et nombre visé suffisent ; le
 * jeu ne dépasse jamais le visé.
 */
export const saveExam = async (
  input: SaveExamInput,
): Promise<SaveExamResult> => {
  const session = await requireRole(["admin"])
  const parsed = saveExamSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const { id, ...settings } = parsed.data

  try {
    const now = Date.now()
    const result = await db.transaction(async (tx) =>
      id
        ? { examId: id, ...(await updateExamTx(tx, id, settings, now)) }
        : {
            examId: await insertExamTx(tx, settings, session.user.id),
            finalized: false,
          },
    )
    revalidateExam(result.examId)
    return { success: true, ...result }
  } catch (error) {
    return examWriteFailure(error, "[saveExam]", session.user.id)
  }
}

export type FinalizePreparedExamResult = { success: true } | ExamWriteFailure

/** [Admin] « Finaliser » un examen en préparation (voir `finalizeInTx`). */
export const finalizePreparedExam = async (input: {
  examId: string
}): Promise<FinalizePreparedExamResult> => {
  const session = await requireRole(["admin"])
  const parsed = examIdSchema.safeParse(input)
  if (!parsed.success) return fail("Examen requis")
  const { examId } = parsed.data

  try {
    await db.transaction(async (tx) => {
      const exam = await lockExam(tx, examId)
      if (exam.finalizedAt) throw new Error("ALREADY_FINALIZED")
      await finalizeInTx(tx, examId, Date.now())
    })
    revalidateExam(examId)
    return { success: true }
  } catch (error) {
    return examWriteFailure(error, "[finalizePreparedExam]", session.user.id)
  }
}

// ============================================
// Admin : compositeur du jeu de questions
// ============================================

export type ComposeResult =
  | {
      success: true
      /** Taille du jeu après l'écriture. */
      count: number
      /** `false` : un examen finalisé vient de repasser en préparation. */
      finalized: boolean
    }
  | ExamWriteFailure

/**
 * Change le jeu sous le verrou de l'examen : refusé dès la première
 * participation (`HAS_PARTICIPATIONS`), jamais au-delà du visé. Un examen
 * finalisé repasse en préparation : il devra être refinalisé, ordre remélangé.
 */
const composeTx = async (
  tx: Tx,
  examId: string,
  change: (current: string[]) => Promise<string[]>,
): Promise<{ count: number; finalized: boolean }> => {
  const exam = await lockExam(tx, examId)
  if (await hasParticipationsTx(tx, examId)) {
    throw new Error("HAS_PARTICIPATIONS")
  }
  const current = await examQuestionIds(tx, examId)
  const next = await change(current)
  if (sameSet(current, next)) {
    return { count: current.length, finalized: exam.finalizedAt !== null }
  }
  // Seul un ajout peut dépasser le visé : un retrait reste permis sur un jeu
  // déjà plus grand que lui (un visé à 0 est possible tant que le défaut de la
  // colonne existe, voir `db/schema/exams.ts`).
  if (next.length > exam.targetQuestionCount && next.length > current.length) {
    throw new ExamInvalid({
      questionIds: `Le jeu ne peut pas dépasser les ${exam.targetQuestionCount} questions visées.`,
    })
  }
  await writeQuestions(tx, examId, next)
  if (exam.finalizedAt !== null) {
    await tx
      .update(exams)
      .set({ finalizedAt: null, completionTime: null })
      .where(eq(exams.id, examId))
  }
  return { count: next.length, finalized: false }
}

const compose = async (
  input: unknown,
  tag: string,
  change: (tx: Tx, current: string[], ids: string[]) => Promise<string[]>,
): Promise<ComposeResult> => {
  const session = await requireRole(["admin"])
  const parsed = composeQuestionsSchema.safeParse(input)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  }
  const { examId, questionIds } = parsed.data
  try {
    const result = await db.transaction((tx) =>
      composeTx(tx, examId, (current) => change(tx, current, questionIds)),
    )
    revalidateExam(examId)
    revalidatePath(`/admin/examens/${examId}/questions`)
    return { success: true, ...result }
  } catch (error) {
    return examWriteFailure(error, tag, session.user.id)
  }
}

/** [Admin] Ajoute des questions au jeu (compositeur), à la suite des autres. */
export const addExamQuestions = async (input: {
  examId: string
  questionIds: string[]
}): Promise<ComposeResult> =>
  compose(input, "[addExamQuestions]", async (tx, current, ids) => {
    const known = new Set(current)
    const added = [...new Set(ids)].filter((id) => !known.has(id))
    await assertQuestionsExist(tx, added)
    return [...current, ...added]
  })

/** [Admin] Retire des questions du jeu (compositeur). */
export const removeExamQuestions = async (input: {
  examId: string
  questionIds: string[]
}): Promise<ComposeResult> =>
  compose(input, "[removeExamQuestions]", async (_tx, current, ids) => {
    const removed = new Set(ids)
    return current.filter((id) => !removed.has(id))
  })

export type CompletionPreview =
  | {
      success: true
      /** Questions tirées, à ajouter par `addExamQuestions`. */
      questionIds: string[]
      /** Par domaine, du plus fourni au moins fourni ; `fallback` = récentes faute d'anciennes. */
      lines: { domain: string; count: number; fallback: number }[]
    }
  | { success: false; error: string }

/**
 * [Admin] Aperçu de « Compléter les N restantes » : un tirage réparti comme la
 * banque, sans questions récentes ni clés à vérifier, avec repli sur les
 * récentes d'un domaine qui manque d'anciennes (voir `planCompletion`). Rien
 * n'est écrit : « Appliquer » passe par `addExamQuestions`, qui revérifie le
 * verrou et le visé.
 */
export const previewExamCompletion = async (input: {
  examId: string
}): Promise<CompletionPreview> => {
  const session = await requireRole(["admin"])
  const parsed = examIdSchema.safeParse(input)
  if (!parsed.success) return fail("Examen requis")
  const { examId } = parsed.data
  try {
    const need = await getRemainingSeats(examId)
    if (need === null) return fail(EXAM_ERRORS.NOT_FOUND)
    const drawn = await drawFromBank(
      examId,
      planCompletion(await getBankSupply(examId), need),
    )
    return {
      success: true,
      questionIds: drawn.map((q) => q.id),
      lines: completionLines(drawn),
    }
  } catch (error) {
    captureServerError("[previewExamCompletion]", error, {
      userId: session.user.id,
    })
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Admin] Supprime un examen (participations + réponses + jonctions en cascade FK). */
export const deleteExam = async (input: {
  examId: string
  /**
   * Participations que l'admin a vues en confirmant : s'il y en a davantage
   * (un étudiant a démarré entre-temps), la suppression est refusée.
   */
  expectedParticipations: number
}): Promise<{ success: boolean; error?: string }> => {
  const session = await requireRole(["admin"])
  const parsed = deleteExamSchema.safeParse(input)
  if (!parsed.success) return fail("Examen requis")
  const { examId, expectedParticipations } = parsed.data

  try {
    const outcome = await db.transaction(async (tx) => {
      await lockExam(tx, examId)
      const [row] = await tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(examParticipations)
        .where(eq(examParticipations.examId, examId))
      if ((row?.n ?? 0) > expectedParticipations) return "CHANGED" as const
      await tx.delete(exams).where(eq(exams.id, examId))
      return "DELETED" as const
    })
    if (outcome === "CHANGED") {
      return fail(
        "Des participations ont commencé depuis l'ouverture de la page : rechargez-la avant de supprimer.",
      )
    }
    revalidatePath("/admin/examens")
    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return fail(EXAM_ERRORS.NOT_FOUND)
    }
    captureServerError("[deleteExam]", error, { userId: session.user.id })
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Admin] Désactive un examen (soft delete, sans cascade). */
export const deactivateExam = async ({
  examId,
}: {
  examId: string
}): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])
  if (!examId) return fail("Examen requis")

  try {
    await db.update(exams).set({ isActive: false }).where(eq(exams.id, examId))
    revalidatePath("/admin/examens")
    revalidatePath(`/admin/examens/${examId}`)
    return { success: true }
  } catch (error) {
    captureServerError("[deactivateExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Admin] Réactive un examen. */
export const reactivateExam = async ({
  examId,
}: {
  examId: string
}): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])
  if (!examId) return fail("Examen requis")

  try {
    await db.update(exams).set({ isActive: true }).where(eq(exams.id, examId))
    revalidatePath("/admin/examens")
    revalidatePath(`/admin/examens/${examId}`)
    return { success: true }
  } catch (error) {
    captureServerError("[reactivateExam]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Admin] Supprime une participation (réponses en cascade) — depuis le leaderboard. */
export const deleteParticipation = async ({
  participationId,
}: {
  participationId: string
}): Promise<{ success: boolean; error?: string }> => {
  await requireRole(["admin"])
  if (!participationId) return fail("Participation requise")

  try {
    const [p] = await db
      .select({ examId: examParticipations.examId })
      .from(examParticipations)
      .where(eq(examParticipations.id, participationId))
      .limit(1)
    if (!p) return fail("Participation introuvable")

    await db
      .delete(examParticipations)
      .where(eq(examParticipations.id, participationId))

    revalidatePath(`/admin/examens/${p.examId}`)
    // L'étudiant peut repasser l'examen : sa liste, sa page et son tableau de bord changent.
    revalidatePath("/tableau-de-bord", "layout")
    return { success: true }
  } catch (error) {
    captureServerError("[deleteParticipation]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}

// ============================================
// Étudiant : cycle de vie de la passation
// ============================================

/**
 * Refus de la garde de tentative (code) ou refus local (message). Le code
 * accompagne le message : le client distingue `TIME_UP` (soumettre, ne pas
 * faire réessayer) sans comparer des libellés.
 */
const refused = (r: Refusal | { message: string }) =>
  "code" in r
    ? { ...fail(refusalMessage(r.code, "exam")), code: r.code }
    : fail(r.message)

export type StartExamResult =
  | { success: true; participationId: string; startedAt: number }
  | { success: false; error: string }

/**
 * [Auth] Démarre (ou reprend) un examen. Garde accès payant et audience
 * (bypass admin) ; finalisation, examen actif et fenêtre de dates pour tous ;
 * une seule participation (idempotent si en cours, refus si déjà passé). Verrou de ligne user → sérialise les démarrages concurrents.
 * Pré-crée les lignes examAnswers (une par question) avec selectedAnswer=null.
 */
export const startExam = async ({
  examId,
}: {
  examId: string
}): Promise<StartExamResult> => {
  const session = await requireSession()
  const userId = session.user.id
  const isAdmin = session.user.role === "admin"
  if (!examId) return fail("Examen requis")

  try {
    const result = await db.transaction(async (tx) => {
      await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .for("update")

      // Verrou de ligne examen (après le verrou user, ordre déterministe) :
      // commun avec les écritures du jeu → un remplacement du set de questions ne peut pas
      // s'intercaler entre la création de la participation et la pré-création des
      // examAnswers.
      const [exam] = await tx
        .select({
          startDate: exams.startDate,
          endDate: exams.endDate,
          audienceType: exams.audienceType,
          isActive: exams.isActive,
          finalizedAt: exams.finalizedAt,
        })
        .from(exams)
        .where(eq(exams.id, examId))
        .for("update")
        .limit(1)
      if (!exam) throw new Error("NOT_FOUND")
      // Sans finalisation, pas de budget de temps : refusé à tous, admin
      // compris, même une fois la date d'ouverture passée. Aucune participation
      // ne peut exister (le jeu ne repasse en préparation qu'avant la
      // première), donc ni reprise ni relecture à préserver.
      if (!exam.finalizedAt || !exam.startDate || !exam.endDate) {
        throw new Error("NOT_FINALIZED")
      }

      const now = Date.now()
      const window = {
        startDate: exam.startDate.getTime(),
        endDate: exam.endDate.getTime(),
      }
      if (now < window.startDate || !isOpen(window, now)) {
        throw new Error("OUTSIDE_WINDOW")
      }

      // Garde d'accès « sélection = accès » :
      // - restricted → appartenance à examAudience requise (pas d'abonnement) ;
      // - subscribers → abonnement examen actif, lu par la transaction.
      if (!isAdmin) {
        if (exam.audienceType === "restricted") {
          const [member] = await tx
            .select({ userId: examAudience.userId })
            .from(examAudience)
            .where(
              and(
                eq(examAudience.examId, examId),
                eq(examAudience.userId, userId),
              ),
            )
            .limit(1)
          if (!member) throw new Error("NOT_IN_AUDIENCE")
        } else if (
          !(await hasActiveAccess(tx, { userId, type: "exam", now }))
        ) {
          throw new Error("ACCESS_EXPIRED")
        }
      }

      const [existing] = await tx
        .select({
          id: examParticipations.id,
          status: examParticipations.status,
          startedAt: examParticipations.startedAt,
        })
        .from(examParticipations)
        .where(
          and(
            eq(examParticipations.examId, examId),
            eq(examParticipations.userId, userId),
          ),
        )
        .limit(1)

      if (existing) {
        if (
          existing.status === "completed" ||
          existing.status === "auto_submitted"
        ) {
          throw new Error("ALREADY_TAKEN")
        }
        if (existing.status === "in_progress") {
          return {
            participationId: existing.id,
            startedAt: existing.startedAt?.getTime() ?? now,
          }
        }
      }

      // Après la reprise ci-dessus : désactiver un examen ferme les nouvelles
      // participations sans couper une épreuve en cours. Admin compris : sa
      // participation compterait dans le classement et les chiffres de la fiche.
      if (!exam.isActive) throw new Error("EXAM_INACTIVE")

      const participationId = createId()
      await tx.insert(examParticipations).values({
        id: participationId,
        examId,
        userId,
        status: "in_progress",
        score: 0,
        startedAt: new Date(now),
      })

      const examQs = await tx
        .select({ questionId: examQuestions.questionId })
        .from(examQuestions)
        .where(eq(examQuestions.examId, examId))
      if (examQs.length > 0) {
        await tx.insert(examAnswers).values(
          examQs.map((q) => ({
            participationId,
            questionId: q.questionId,
            selectedAnswer: null,
            isCorrect: null,
            isFlagged: false,
          })),
        )
      }

      return { participationId, startedAt: now }
    })

    return { success: true, ...result }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return fail("Examen introuvable.")
      if (error.message === "OUTSIDE_WINDOW") {
        return fail("L'examen n'est pas disponible à cette période.")
      }
      if (error.message === "ALREADY_TAKEN") {
        return fail("Vous avez déjà passé cet examen.")
      }
      if (error.message === "NOT_IN_AUDIENCE") {
        return fail("Cet examen ne vous est pas destiné.")
      }
      if (error.message === "ACCESS_EXPIRED") {
        return fail("Votre accès aux examens a expiré.")
      }
      if (error.message === "EXAM_INACTIVE") {
        return fail("Cet examen n'est plus disponible.")
      }
      if (error.message === "NOT_FINALIZED") {
        return fail(
          "Cet examen est en préparation : il n'est pas encore ouvert.",
        )
      }
    }
    captureServerError("[startExam]", error, { userId })
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Auth] Enregistre ou met à jour la réponse d'une question sous la garde
 * `answer` de la participation (fenêtre, accès, pause, budget de temps à
 * L'ÉCRITURE). Anti-triche : isCorrect jamais retourné au client.
 */
export const saveExamAnswer = async (
  input: SaveExamAnswerInput,
): Promise<{
  success: boolean
  error?: string
  code?: RefusalCode | typeof OPTION_CHANGED
  serverNow?: number
}> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)

  const parsed = saveExamAnswerSchema.safeParse(input)
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { examId, questionId, selectedAnswer } = parsed.data

  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "exam",
        ref: examId,
        actor,
        now,
        verb: "answer",
      })
      if (!guard.ok) return guard

      // Appartenance + clé, lues APRÈS la garde : avant elle, le message
      // distinguerait une question de l'examen d'une question étrangère pour
      // un examen à venir ou un non-abonné.
      const [q] = await tx
        .select({
          correctAnswer: questions.correctAnswer,
          options: questions.options,
        })
        .from(examQuestions)
        .innerJoin(questions, eq(questions.id, examQuestions.questionId))
        .where(
          and(
            eq(examQuestions.examId, examId),
            eq(examQuestions.questionId, questionId),
          ),
        )
        .limit(1)
      if (!q) {
        return {
          ok: false as const,
          message: "Cette question ne fait pas partie de l'examen.",
        }
      }
      if (!q.options.includes(selectedAnswer)) {
        return { ok: false as const, optionChanged: true as const }
      }
      const isCorrect = q.correctAnswer === selectedAnswer

      const updated = await tx
        .update(examAnswers)
        .set({ selectedAnswer, isCorrect })
        .where(
          and(
            eq(examAnswers.participationId, guard.attempt.id),
            eq(examAnswers.questionId, questionId),
          ),
        )
        .returning({ id: examAnswers.id })
      if (updated.length === 0) {
        return {
          ok: false as const,
          message: "Réponse non enregistrée (session incohérente).",
        }
      }
      return { ok: true as const }
    })

    if (!outcome.ok)
      return "optionChanged" in outcome ? optionChanged() : refused(outcome)
    // Jamais isCorrect (anti-triche) ; `serverNow` ré-ancre le chrono client.
    return { success: true, serverNow: now }
  } catch (error) {
    captureServerError("[saveExamAnswer]", error, { userId: actor.id })
    return fail("Erreur serveur. Réessayez.")
  }
}

/** [Auth] Marque ou démarque une question (garde `flag` : statut seul). */
export const saveExamFlag = async (
  input: SaveExamFlagInput,
): Promise<{ success: boolean; error?: string }> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)
  const parsed = saveExamFlagSchema.safeParse(input)
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { examId, questionId, isFlagged } = parsed.data
  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "exam",
        ref: examId,
        actor,
        now,
        verb: "flag",
      })
      if (!guard.ok) return guard
      const updated = await tx
        .update(examAnswers)
        .set({ isFlagged })
        .where(
          and(
            eq(examAnswers.participationId, guard.attempt.id),
            eq(examAnswers.questionId, questionId),
          ),
        )
        .returning({ id: examAnswers.id })
      if (updated.length === 0) {
        return {
          ok: false as const,
          message: "Marquage non enregistré (session incohérente).",
        }
      }
      return { ok: true as const }
    })
    if (!outcome.ok) return refused(outcome)
    return { success: true }
  } catch (error) {
    captureServerError("[saveExamFlag]", error, { userId: actor.id })
    return fail("Erreur serveur. Réessayez.")
  }
}

export type FinalizeExamResult =
  { success: true } | { success: false; error: string }

/**
 * [Auth] Finalise un examen sous la garde `close` : la clôture (statut, score
 * de clôture, `completedAt`) est écrite par `closeAttempts`, l'action n'y
 * ajoute que le crédit d'une pause en cours. `isAutoSubmit` vient du client :
 * la garde ne lui accorde que l'exemption du budget (les réponses sont gardées
 * à l'écriture).
 * Anti-triche : ni isCorrect ni le décompte des justes ne repartent vers le
 * navigateur (voir `scoreWithheldFor`) ; les résultats se lisent par la DAL
 * après clôture.
 */
export const finalizeExam = async (
  input: FinalizeExamInput,
): Promise<FinalizeExamResult> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)

  const parsed = finalizeExamSchema.safeParse(input)
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Données invalides")
  const { examId, isAutoSubmit } = parsed.data

  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "exam",
        ref: examId,
        actor,
        now,
        verb: "close",
        isAutoSubmit,
      })
      if (!guard.ok) return guard
      const { id, timing } = guard.attempt

      await closeAttempts(tx, {
        kind: "exam",
        status: isAutoSubmit ? "auto_submitted" : "completed",
        now: new Date(now),
        where: { id },
        set: {
          pauseStartedAt: null,
          totalPauseDurationMs: pauseCredit(timing, now),
        },
      })
      return { ok: true as const }
    })
    if (!outcome.ok) return refused(outcome)
    return { success: true }
  } catch (error) {
    captureServerError("[finalizeExam]", error, { userId: actor.id })
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Auth] Heure du serveur, sans lecture en base. Demandée par le runner au
 * réveil de l'onglet quand son horloge monotone a décroché de l'horloge murale
 * (veille du système) : la seule façon de réaligner le chrono sans se fier à
 * l'horloge du navigateur.
 */
export const readServerClock = async (): Promise<{
  success: true
  serverNow: number
}> => {
  await requireSession()
  return { success: true, serverNow: Date.now() }
}

/**
 * [Auth] Démarre la pause (garde `pause` : statut seul). Vérifie que la pause
 * est activée et qu'aucune pause n'a déjà été utilisée.
 */
export const pauseExam = async ({
  examId,
}: {
  examId: string
}): Promise<{
  success: boolean
  error?: string
  pauseStartedAt?: number
  pauseDurationMinutes?: number
  serverNow?: number
}> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)
  if (!examId) return fail("Examen requis")
  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "exam",
        ref: examId,
        actor,
        now,
        verb: "pause",
      })
      if (!guard.ok) return guard
      const { id, timing, exam } = guard.attempt
      if (!exam.enablePause) {
        return {
          ok: false as const,
          message: "La pause n'est pas activée pour cet examen.",
        }
      }
      if (timing.pauseInProgress) {
        return { ok: false as const, message: "Vous êtes déjà en pause." }
      }
      if (timing.pauseCreditMs > 0) {
        return { ok: false as const, message: "La pause a déjà été utilisée." }
      }
      await tx
        .update(examParticipations)
        .set({ pauseStartedAt: new Date(now) })
        .where(eq(examParticipations.id, id))
      return {
        ok: true as const,
        pauseDurationMinutes:
          exam.pauseDurationMinutes ?? DEFAULT_PAUSE_MINUTES,
      }
    })
    if (!outcome.ok) return refused(outcome)
    return {
      success: true,
      pauseStartedAt: now,
      pauseDurationMinutes: outcome.pauseDurationMinutes,
      serverNow: now,
    }
  } catch (error) {
    captureServerError("[pauseExam]", error, { userId: actor.id })
    return fail("Erreur serveur. Réessayez.")
  }
}

/**
 * [Auth] Reprend après la pause (garde `resume` : statut seul). Crédite la
 * durée réelle écoulée, plafonnée à la durée de pause de l'examen.
 */
export const resumeExam = async ({
  examId,
}: {
  examId: string
}): Promise<{
  success: boolean
  error?: string
  totalPauseDurationMs?: number
  serverNow?: number
}> => {
  const session = await requireSession()
  const actor = viewerOf(session.user)
  if (!examId) return fail("Examen requis")
  try {
    const now = Date.now()
    const outcome = await db.transaction(async (tx) => {
      const guard = await requireAttempt(tx, {
        kind: "exam",
        ref: examId,
        actor,
        now,
        verb: "resume",
      })
      if (!guard.ok) return guard
      const { id, timing } = guard.attempt
      if (!timing.pauseInProgress) {
        return { ok: false as const, message: "Vous n'êtes pas en pause." }
      }
      const total = pauseCredit(timing, now)
      await tx
        .update(examParticipations)
        .set({ pauseStartedAt: null, totalPauseDurationMs: total })
        .where(eq(examParticipations.id, id))
      return { ok: true as const, total }
    })
    if (!outcome.ok) return refused(outcome)
    return {
      success: true,
      totalPauseDurationMs: outcome.total,
      serverNow: now,
    }
  } catch (error) {
    captureServerError("[resumeExam]", error, { userId: actor.id })
    return fail("Erreur serveur. Réessayez.")
  }
}
