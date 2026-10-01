import type { SummaryCheck } from "@/components/shared/form-steps"
import {
  EXPLANATION_MAX_LENGTH,
  REFERENCE_MAX_LENGTH,
} from "@/features/questions/normalization"

// Module pur : l'état du formulaire de question, ses vérifications et la
// charge envoyée au serveur.

export const MIN_OPTIONS = 4
export const MAX_OPTIONS = 5
export const MAX_REFERENCES = 50

export type FormImage = { url: string; storagePath: string; order: number }

export type QuestionFormValues = {
  domain: string
  objective: string
  question: string
  options: string[]
  /**
   * Index d'origine de chaque choix (`null` = ajouté) : suit les réponses
   * passées quand un choix est retiré, ajouté ou reformulé.
   */
  sources: (number | null)[]
  keyIndex: number | null
  explanation: string
  references: string[]
  statementImages: FormImage[]
  explanationImages: FormImage[]
}

export const blankQuestionForm = (
  keep?: Pick<QuestionFormValues, "domain" | "objective">,
): QuestionFormValues => ({
  domain: keep?.domain ?? "",
  objective: keep?.objective ?? "",
  question: "",
  options: ["", "", "", ""],
  sources: [null, null, null, null],
  keyIndex: null,
  explanation: "",
  references: [""],
  statementImages: [],
  explanationImages: [],
})

/** Même règle que le serveur (`findDuplicateOption`) : espaces de bord et casse ignorés. */
const optionKey = (option: string) => option.trim().toLocaleLowerCase("fr")

/** Pour chaque choix, l'index d'un autre choix identique, ou `-1`. */
export const duplicateOf = (options: string[]): number[] =>
  options.map((option, i) => {
    const key = optionKey(option)
    if (key === "") return -1
    return options.findIndex((other, j) => j !== i && optionKey(other) === key)
  })

/** Étape du formulaire où se corrige chaque vérification. */
export type QuestionFormStep =
  "classement" | "enonce" | "choix" | "explication" | "references"

type Check = SummaryCheck & { step: QuestionFormStep }

/**
 * Vérifications de la colonne de synthèse, dans l'ordre des étapes. Sous des
 * choix figés, les choix et la clé ne se vérifient pas : ils ne changent pas.
 * `showErrors` après une tentative refusée : une vérification en échec passe
 * de « à faire » à « erreur ».
 */
export const questionFormChecks = (
  v: QuestionFormValues,
  { frozen, showErrors }: { frozen: boolean; showErrors: boolean },
): Check[] => {
  const trimmed = v.options.map((o) => o.trim())
  const tooLong =
    v.explanation.length > EXPLANATION_MAX_LENGTH ||
    v.references.some((r) => r.length > REFERENCE_MAX_LENGTH)
  const raw: [string, QuestionFormStep, boolean, string][] = [
    [
      "classement",
      "classement",
      !!v.domain && !!v.objective.trim(),
      "Domaine et objectif du CMC",
    ],
    ["enonce", "enonce", !!v.question.trim(), "Énoncé rédigé"],
    ...(frozen
      ? []
      : ([
          [
            "choix",
            "choix",
            v.options.length >= MIN_OPTIONS &&
              v.options.length <= MAX_OPTIONS &&
              trimmed.every(Boolean),
            "4 ou 5 choix de réponse",
          ],
          [
            "cle",
            "choix",
            v.keyIndex !== null && !!trimmed[v.keyIndex],
            "Une clé de réponse désignée",
          ],
          [
            "doublons",
            "choix",
            duplicateOf(v.options).every((d) => d < 0),
            "Aucun choix en double",
          ],
        ] as [string, QuestionFormStep, boolean, string][])),
    [
      "explication",
      "explication",
      !!v.explanation.trim(),
      "Explication rédigée",
    ],
    ...(tooLong
      ? ([
          [
            "longueurs",
            v.explanation.length > EXPLANATION_MAX_LENGTH
              ? "explication"
              : "references",
            false,
            "Longueurs maximales respectées",
          ],
        ] as [string, QuestionFormStep, boolean, string][])
      : []),
  ]
  const checks: Check[] = raw.map(([id, step, ok, label]) => ({
    id,
    step,
    label,
    state: ok ? "ok" : showErrors ? "error" : "todo",
  }))
  if (frozen)
    checks.splice(2, 0, {
      id: "verrou",
      step: "choix",
      label: "Choix et clé verrouillés (examen ouvert)",
      state: "locked",
    })
  return checks
}

export const hasReferences = (v: QuestionFormValues) =>
  v.references.some((r) => r.trim() !== "")

/** Charge des actions `createQuestion` / `updateQuestion`. Les choix ne sont jamais rognés. */
export const toQuestionPayload = (v: QuestionFormValues) => ({
  question: v.question,
  options: v.options,
  correctAnswer: v.keyIndex === null ? "" : (v.options[v.keyIndex] ?? ""),
  explanation: v.explanation,
  references: v.references.filter((r) => r.trim() !== ""),
  objectifCMC: v.objective,
  domain: v.domain,
})

/** Instantané comparable : le formulaire est-il modifié depuis le chargement ? */
export const snapshotOf = (v: QuestionFormValues) =>
  JSON.stringify({
    ...v,
    statementImages: v.statementImages.map((i) => i.storagePath),
    explanationImages: v.explanationImages.map((i) => i.storagePath),
  })

/**
 * Identifiant réservé pour la question suivante. `crypto.randomUUID` n'existe
 * qu'en contexte sécurisé (HTTPS, localhost) : un test sur téléphone par
 * l'adresse du réseau local passe par `getRandomValues`.
 */
export const newQuestionId = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
