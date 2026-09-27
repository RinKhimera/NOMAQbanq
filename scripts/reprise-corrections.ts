/**
 * Reprise des corrections existantes : applique la normalisation (découpage des
 * blocs de références compris) aux questions déjà en base.
 *
 * PASSAGE À BLANC par défaut : lit, planifie et écrit le rapport, sans toucher
 * la base. `--apply` écrit les cas sûrs. Le plan est `planCorrection`
 * (features/questions/normalization.ts) ; ce script n'en est que la coque.
 *
 * Usage :
 *   REPRISE_DATABASE_URL=... bun scripts/reprise-corrections.ts
 *   ... -- --apply                 # écrit
 *   ... -- --ids id1,id2           # limite la reprise à ces questions
 *   ... -- --report chemin.md      # défaut : reprise-corrections.md
 *
 * Env distinct des vars runtime : une écriture en masse ne doit jamais partir
 * par accident sur la base de l'environnement courant. L'hôte ciblé est
 * affiché au démarrage.
 *
 * Chaque écriture est conditionnée au contenu lu : une question modifiée (ou
 * supprimée) entre la lecture et l'écriture est sautée, jamais écrasée. La
 * normalisation se stabilise, donc relancer après une application n'écrit plus
 * rien.
 *
 * N'importe pas @/db (schéma d'env complet requis hors Next).
 *
 * Sorties : 0 terminé · 1 erreur d'usage ou d'exécution.
 */
import { and, asc, eq, exists, gt, inArray, isNull, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { writeFileSync } from "node:fs"
import { Pool } from "pg"
import { questionExplanations, questions } from "../db/schema"
import {
  type Correction,
  type FormatIssue,
  planCorrection,
} from "../features/questions/normalization"

const BATCH = 200

type Db = ReturnType<typeof drizzle>

export type StoredCorrection = {
  id: string
  explanation: string
  references: string[] | null
}

export type RepairOutcome = {
  id: string
  /** `conflict` : prévue, mais la question a changé depuis la lecture. */
  action: "write" | "skip" | "review" | "conflict"
  before: Correction
  after?: Correction
  issues: FormatIssue[]
}

const activeQuestion = (db: Db, id: string) =>
  exists(
    db
      .select({ one: sql`1` })
      .from(questions)
      .where(and(eq(questions.id, id), isNull(questions.deletedAt))),
  )

async function* readCorrections(
  db: Db,
  ids: readonly string[] | null,
): AsyncGenerator<StoredCorrection[]> {
  let cursor = ""
  for (;;) {
    const batch = await db
      .select({
        id: questionExplanations.questionId,
        explanation: questionExplanations.explanation,
        references: questionExplanations.references,
      })
      .from(questionExplanations)
      .innerJoin(questions, eq(questions.id, questionExplanations.questionId))
      .where(
        and(
          isNull(questions.deletedAt),
          gt(questionExplanations.questionId, cursor),
          ids ? inArray(questionExplanations.questionId, [...ids]) : undefined,
        ),
      )
      .orderBy(asc(questionExplanations.questionId))
      .limit(BATCH)
    if (batch.length > 0) yield batch
    if (batch.length < BATCH) return
    cursor = batch[batch.length - 1]!.id
  }
}

/** Écrit `next` seulement si la ligne est encore celle lue ; `false` sinon. */
export async function writeCorrection(
  db: Db,
  row: StoredCorrection,
  next: Correction,
): Promise<boolean> {
  const col = questionExplanations.references
  const updated = await db
    .update(questionExplanations)
    .set({
      explanation: next.explanation,
      // Pas de liste vide à la place d'un champ jamais rempli.
      references:
        row.references === null && next.references.length === 0
          ? null
          : next.references,
    })
    .where(
      and(
        eq(questionExplanations.questionId, row.id),
        eq(questionExplanations.explanation, row.explanation),
        row.references === null
          ? isNull(col)
          : sql`${col} = ${JSON.stringify(row.references)}::jsonb`,
        activeQuestion(db, row.id),
      ),
    )
    .returning({ id: questionExplanations.questionId })
  return updated.length === 1
}

export async function repairCorrections(
  db: Db,
  options: { apply: boolean; ids?: readonly string[] | null },
): Promise<RepairOutcome[]> {
  const outcomes: RepairOutcome[] = []
  for await (const batch of readCorrections(db, options.ids ?? null)) {
    for (const row of batch) {
      const before = {
        explanation: row.explanation,
        references: row.references ?? [],
      }
      const plan = planCorrection(before)
      if (plan.action !== "write") {
        outcomes.push({
          id: row.id,
          action: plan.action,
          before,
          issues: plan.issues,
        })
        continue
      }
      const written =
        !options.apply || (await writeCorrection(db, row, plan.next))
      outcomes.push({
        id: row.id,
        action: written ? "write" : "conflict",
        before,
        after: plan.next,
        issues: plan.issues,
      })
    }
  }
  return outcomes
}

// ===== Rapport =====

const SAMPLE_COUNT = 5
const SAMPLE_MAX_CHARS = 1500

const CHECK_ORDER: Record<RepairOutcome["action"], number> = {
  review: 0,
  conflict: 1,
  write: 2,
  skip: 3,
}

const editLink = (id: string) => `/admin/questions/${id}/modifier`

const excerpt = (text: string) =>
  text.length > SAMPLE_MAX_CHARS
    ? `${text.slice(0, SAMPLE_MAX_CHARS)}\n… (${text.length} caractères)`
    : text

const fence = (text: string) => ["```text", excerpt(text), "```"].join("\n")

const describeIssue = (issue: FormatIssue) =>
  issue.index === undefined
    ? issue.message
    : `Référence ${issue.index + 1} : ${issue.message}`

const sample = (outcome: RepairOutcome) => [
  `### ${outcome.id}`,
  "",
  `Avant : ${outcome.before.references.length} référence(s)`,
  "",
  fence(outcome.before.references.join("\n\n---\n\n")),
  "",
  `Après : ${outcome.after!.references.length} référence(s)`,
  "",
  ...outcome.after!.references.map((ref, i) => `${i + 1}. ${ref}`),
  "",
]

/**
 * Rapport Markdown : comptes par catégorie, échantillons avant/après des
 * découpages, puis la liste « à vérifier » avec motif et lien d'édition.
 */
export function formatReport(
  outcomes: readonly RepairOutcome[],
  meta: { apply: boolean; host: string; date: Date },
): string {
  const count = (action: RepairOutcome["action"]) =>
    outcomes.filter((o) => o.action === action).length
  // Ce qui n'a rien reçu d'abord : c'est là que le travail manuel commence.
  const toCheck = outcomes
    .filter((o) => o.issues.length > 0 || o.action === "conflict")
    .sort((a, b) => CHECK_ORDER[a.action] - CHECK_ORDER[b.action])
  const splits = outcomes
    .filter(
      (o) =>
        o.action === "write" &&
        o.after!.references.length !== o.before.references.length,
    )
    .slice(0, SAMPLE_COUNT)

  const verb = meta.apply ? "écrites" : "à écrire"
  const lines = [
    `# Reprise des corrections — ${meta.apply ? "application" : "passage à blanc"}`,
    "",
    `Base : \`${meta.host}\` · ${meta.date.toISOString()}`,
    "",
    "| Catégorie | Questions |",
    "| --- | --- |",
    `| Mise en forme ${verb} | ${count("write")} |`,
    `| Déjà propres (sautées) | ${count("skip")} |`,
    `| À vérifier, rien écrit | ${count("review")} |`,
    ...(meta.apply
      ? [`| Modifiées depuis la lecture (sautées) | ${count("conflict")} |`]
      : []),
    `| **Total** | ${outcomes.length} |`,
    "",
    `Mise en forme à vérifier : ${toCheck.length} question(s), dont ${toCheck.filter((o) => o.action === "write").length} ${verb} quand même (motif de contenu, pas de découpage douteux).`,
    "",
    "## Échantillons avant / après",
    "",
    ...(splits.length === 0
      ? ["Aucun découpage.", ""]
      : splits.flatMap(sample)),
    "## Mise en forme à vérifier",
    "",
  ]
  if (toCheck.length === 0) return [...lines, "Aucune.", ""].join("\n")

  const status: Record<RepairOutcome["action"], string> = {
    review: "rien écrit",
    write: meta.apply ? "écrite" : "à écrire",
    skip: "déjà propre",
    conflict: "modifiée depuis la lecture",
  }
  return [
    ...lines,
    "| Question | Statut | Motifs |",
    "| --- | --- | --- |",
    ...toCheck.map(
      (o) =>
        `| [${o.id}](${editLink(o.id)}) | ${status[o.action]} | ${
          o.action === "conflict"
            ? "Relancer la reprise pour cette question."
            : o.issues.map(describeIssue).join("<br>")
        } |`,
    ),
    "",
  ].join("\n")
}

// ===== Coque =====

const arg = (flag: string): string | null => {
  const i = process.argv.indexOf(flag)
  return i === -1 ? null : (process.argv[i + 1] ?? null)
}

const main = async (): Promise<number> => {
  const url = process.env.REPRISE_DATABASE_URL
  if (!url) {
    console.error(
      "Env manquant : REPRISE_DATABASE_URL (branche Neon à reprendre).",
    )
    return 1
  }
  const apply = process.argv.includes("--apply")
  const ids = arg("--ids")?.split(",").filter(Boolean) ?? null
  const reportPath = arg("--report") ?? "reprise-corrections.md"
  const host = new URL(url).hostname

  console.log(
    `Cible : ${host} · ${apply ? "APPLICATION (écriture)" : "passage à blanc (aucune écriture)"}${ids ? ` · ${ids.length} question(s)` : ""}`,
  )

  const pool = new Pool({ connectionString: url, max: 2 })
  try {
    const outcomes = await repairCorrections(drizzle(pool), { apply, ids })
    const report = formatReport(outcomes, { apply, host, date: new Date() })
    writeFileSync(reportPath, report)
    const tally = (action: RepairOutcome["action"]) =>
      outcomes.filter((o) => o.action === action).length
    console.log(
      `${outcomes.length} question(s) · ${apply ? "écrites" : "à écrire"} ${tally("write")} · déjà propres ${tally("skip")} · à vérifier sans écriture ${tally("review")}${apply ? ` · modifiées entre-temps ${tally("conflict")}` : ""}`,
    )
    console.log(`Rapport : ${reportPath}`)
    return 0
  } finally {
    await pool.end()
  }
}

const isDirectRun = process.argv[1]?.endsWith("reprise-corrections.ts") ?? false
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error("Reprise interrompue :", error)
      process.exit(1)
    })
}
