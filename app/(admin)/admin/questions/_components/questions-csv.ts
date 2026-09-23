import type { QuestionExportRow } from "@/features/questions/dal"
import { csvQuote } from "@/lib/export"

const HEADERS = [
  "ID",
  "Question",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "Option E",
  "Réponse correcte",
  "Explication",
  "Domaine",
  "Objectif CMC",
  "Références",
  "Avec images",
  "Nombre d'images",
  "Date de création",
  "Réussite (%)",
  "Réponses",
]

/** Lignes CSV de l'export : tout texte libre est entre guillemets. */
export const questionsCsvLines = (questions: QuestionExportRow[]): string[] => [
  HEADERS.join(","),
  ...questions.map((q) =>
    [
      q.id,
      csvQuote(q.question),
      q.options[0] ? csvQuote(q.options[0]) : "",
      q.options[1] ? csvQuote(q.options[1]) : "",
      q.options[2] ? csvQuote(q.options[2]) : "",
      q.options[3] ? csvQuote(q.options[3]) : "",
      q.options[4] ? csvQuote(q.options[4]) : "",
      csvQuote(q.correctAnswer),
      csvQuote(q.explanation),
      csvQuote(q.domain),
      csvQuote(q.objectifCMC),
      csvQuote(q.references.join("; ")),
      q.hasImages ? "Oui" : "Non",
      q.imagesCount,
      new Date(q.createdAt).toISOString(),
      q.successRate ?? "",
      q.answerCount,
    ].join(","),
  ),
]
