import { z } from "zod"
import { isMedicalDomain } from "@/constants"
import { KEY_CONFIRMATION_NOTE_MAX } from "./key-review"
import {
  EXPLANATION_MAX_LENGTH,
  REFERENCE_MAX_LENGTH,
  normalizeExplanation,
  tidyReference,
} from "./normalization"

/**
 * Texte non vide, enregistré tel quel. Options et clé ne sont jamais rognées :
 * une réponse se compare au texte exact de l'option, et rogner à
 * l'enregistrement reformulerait en silence des options existantes.
 */
const exactText = (message?: string) =>
  z.string().refine((text) => text.trim().length > 0, message)

// « 20 000 » : espace simple, pas l'espace insécable de toLocaleString, pour
// un message identique quel que soit le moteur.
const formatCount = (n: number) => String(n).replace(/\B(?=(\d{3})+$)/g, " ")

// Seule la partie sûre de la normalisation s'applique à l'enregistrement :
// une référence n'est jamais découpée sans que l'admin l'ait vue. La
// normalisation garde les espaces fines insécables, d'où le `trim()` du test
// de vacuité : un texte qui n'est fait que d'elles est vide.
const hasText = (text: string) => text.trim() !== ""

const explanationField = z
  .string()
  .transform(normalizeExplanation)
  .pipe(
    z
      .string()
      .refine(hasText, "L'explication est requise")
      .max(
        EXPLANATION_MAX_LENGTH,
        `L'explication dépasse ${formatCount(EXPLANATION_MAX_LENGTH)} caractères : vérifiez qu'une page entière n'a pas été collée.`,
      ),
  )

const referenceField = z
  .string()
  .transform(tidyReference)
  .pipe(
    z
      .string()
      .refine(
        hasText,
        "Une référence est vide une fois mise en forme : retirez-la ou complétez-la.",
      )
      .max(
        REFERENCE_MAX_LENGTH,
        `Une référence dépasse ${formatCount(REFERENCE_MAX_LENGTH)} caractères : elle contient sans doute plusieurs sources. Découpez-la avant d'enregistrer.`,
      ),
  )

// Champs communs création/édition. Une question = 4 ou 5 choix, la clé de
// réponse devant figurer parmi eux (refine sur l'objet complet).
const questionFields = {
  question: z.string().trim().min(1, "L'énoncé est requis"),
  options: z
    .array(exactText("Un choix de réponse ne peut pas être vide"))
    .min(4, "4 choix de réponse au moins")
    .max(5, "5 choix de réponse au plus"),
  correctAnswer: exactText("La clé de réponse est requise"),
  explanation: explanationField,
  references: z
    .array(referenceField)
    .max(50, "Au plus 50 références")
    .optional(),
  /** Objectif du référentiel ; aucune valeur libre. */
  objectiveId: z.string().trim().min(1, "L'objectif du CMC est requis").max(64),
  domain: z
    .string()
    .trim()
    .min(1, "Le domaine est requis")
    .refine((domain): boolean => isMedicalDomain(domain), "Domaine inconnu"),
}

const correctAnswerInOptions = (d: {
  options: string[]
  correctAnswer: string
}) => d.options.includes(d.correctAnswer)
const correctAnswerIssue = {
  message: "La clé de réponse doit figurer parmi les choix",
  path: ["correctAnswer"],
}

/**
 * Premier doublon d'options, espaces de bord et casse ignorés : sinon la clé
 * devient ambiguë et la répartition des réponses compte deux fois. Les
 * options vides (cases non remplies du formulaire) ne comptent pas ; les
 * index sont ceux du tableau reçu, donc les lettres affichées à l'admin.
 */
export const findDuplicateOption = (
  options: string[],
): { first: number; duplicate: number } | null => {
  const seen = new Map<string, number>()
  for (const [index, option] of options.entries()) {
    const key = option.trim().toLocaleLowerCase("fr")
    if (key === "") continue
    const first = seen.get(key)
    if (first !== undefined) return { first, duplicate: index }
    seen.set(key, index)
  }
  return null
}

const optionLetter = (index: number) => String.fromCharCode(65 + index)

/** Refus « options identiques » sur le champ des options, lettres à l'appui. */
export const refineDistinctOptions = (
  data: { options: string[] },
  ctx: z.RefinementCtx,
) => {
  const found = findDuplicateOption(data.options)
  if (!found) return
  ctx.addIssue({
    code: "custom",
    path: ["options"],
    message: `Le choix ${optionLetter(found.duplicate)} est identique au choix ${optionLetter(found.first)} (casse et espaces ignorés)`,
  })
}

/**
 * Identifiant réservé à l'ouverture du formulaire, pour que les images
 * s'envoient avant la création. Caractères d'URL sûrs seulement : il entre
 * dans un chemin de stockage.
 */
export const QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export const createQuestionSchema = z
  .object({
    id: z.string().regex(QUESTION_ID_PATTERN, "Question invalide").optional(),
    ...questionFields,
  })
  .refine(correctAnswerInOptions, correctAnswerIssue)
  .superRefine(refineDistinctOptions)

export type CreateQuestionInput = z.input<typeof createQuestionSchema>

export const updateQuestionSchema = z
  .object({ id: z.string().min(1), ...questionFields })
  .refine(correctAnswerInOptions, correctAnswerIssue)
  .superRefine(refineDistinctOptions)

export type UpdateQuestionInput = z.input<typeof updateQuestionSchema>

export const confirmQuestionKeySchema = z.object({
  id: z.string().min(1),
  note: z
    .string()
    .trim()
    .max(
      KEY_CONFIRMATION_NOTE_MAX,
      `${KEY_CONFIRMATION_NOTE_MAX} caractères au plus.`,
    )
    .optional(),
})

export type ConfirmQuestionKeyInput = z.input<typeof confirmQuestionKeySchema>

export const setQuestionImagesSchema = z.object({
  questionId: z.string().min(1),
  kind: z.enum(["statement", "explanation"]).default("statement"),
  images: z
    .array(
      z.object({
        storagePath: z.string().min(1),
        order: z.number().int().nonnegative(),
        // `url` est dérivée du CDN côté client ; on ne persiste que storagePath+position.
        url: z.string().optional(),
      }),
    )
    .max(20),
})

// `z.input` (pas `z.infer`/output) : `kind` a un `.default("statement")`, donc
// optionnel à l'appel (callers existants `{ questionId, images }`) mais toujours
// défini après `safeParse`.
export type SetQuestionImagesInput = z.input<typeof setQuestionImagesSchema>

// Entrées PUBLIQUES (quiz marketing, appelant anonyme) : le schéma ne valide que
// le TYPE ; la borne effective vit dans la DAL (`clamp(count, 1, 10)`).
// Refus silencieux côté action (pas de message d'erreur → pas d'oracle).
// Sans zod sur le tirage, `count: "abc"` → clamp = NaN → `LIMIT NaN` → 500.
export const loadRandomQuizQuestionsSchema = z.object({
  count: z.number().int(),
  domain: z.string().max(100).optional(),
})

export const scoreQuizAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(64),
        selectedAnswer: z.string().max(500).nullable(),
      }),
    )
    .max(10),
  token: z.string().min(1).max(2048),
})
