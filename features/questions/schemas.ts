import { z } from "zod"
import { isMedicalDomain } from "@/constants"
import { normalizeExplanation, tidyReference } from "./normalization"

/**
 * Texte non vide, enregistré tel quel. Options et clé ne sont jamais rognées :
 * une réponse se compare au texte exact de l'option, et rogner à
 * l'enregistrement reformulerait en silence des options existantes.
 */
const exactText = (message?: string) =>
  z.string().refine((text) => text.trim().length > 0, message)

/**
 * Plafonds de la correction. La plus longue source légitime observée fait 737
 * caractères, la plus longue explication 11 902 (develop, 2026-09-27) : au-delà,
 * c'est un bloc de sources ou une page entière collés dans un seul champ.
 */
export const REFERENCE_MAX_LENGTH = 2000
export const EXPLANATION_MAX_LENGTH = 20_000

// Seule la partie sûre de la normalisation s'applique à l'enregistrement :
// une référence n'est jamais découpée sans que l'admin l'ait vue.
const explanationField = z
  .string()
  .transform(normalizeExplanation)
  .pipe(
    z
      .string()
      .min(1, "L'explication est requise")
      .max(
        EXPLANATION_MAX_LENGTH,
        "L'explication dépasse 20 000 caractères : vérifiez qu'une page entière n'a pas été collée.",
      ),
  )

const referenceField = z
  .string()
  .transform(tidyReference)
  .pipe(
    z
      .string()
      .min(1)
      .max(
        REFERENCE_MAX_LENGTH,
        "Une référence dépasse 2 000 caractères : elle contient sans doute plusieurs sources. Découpez-la avant d'enregistrer.",
      ),
  )

// Champs communs création/édition. Une question QCM = 2..8 options, la bonne
// réponse devant figurer parmi elles (refine sur l'objet complet).
const questionFields = {
  question: z.string().trim().min(1, "La question est requise"),
  options: z
    .array(exactText("Une option ne peut pas être vide"))
    .min(2, "Au moins 2 options")
    .max(8, "Au plus 8 options"),
  correctAnswer: exactText("La bonne réponse est requise"),
  explanation: explanationField,
  references: z
    .array(referenceField)
    .max(50, "Au plus 50 références")
    .optional(),
  objectifCMC: z.string().trim().min(1, "L'objectif CMC est requis"),
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
  message: "La bonne réponse doit figurer parmi les options",
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
    message: `L'option ${optionLetter(found.duplicate)} est identique à l'option ${optionLetter(found.first)} (casse et espaces ignorés)`,
  })
}

export const createQuestionSchema = z
  .object(questionFields)
  .refine(correctAnswerInOptions, correctAnswerIssue)
  .superRefine(refineDistinctOptions)

export type CreateQuestionInput = z.input<typeof createQuestionSchema>

export const updateQuestionSchema = z
  .object({ id: z.string().min(1), ...questionFields })
  .refine(correctAnswerInOptions, correctAnswerIssue)
  .superRefine(refineDistinctOptions)

export type UpdateQuestionInput = z.input<typeof updateQuestionSchema>

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
