/**
 * Reprise des corrections existantes : applique la normalisation (découpage des
 * blocs de références compris) aux questions déjà en base.
 *
 * PASSAGE À BLANC par défaut : lit, planifie et écrit le rapport, sans toucher
 * la base. `--apply` écrit les cas sûrs. Le plan est `planCorrection`
 * (features/questions/normalization.ts) ; ce script n'en est que la coque.
 *
 * Usage :
 *   REPRISE_DATABASE_URL=... bun run reprise:corrections
 *   ... -- --apply                 # écrit
 *   ... -- --ids id1,id2           # limite la reprise à ces questions
 *   ... -- --report chemin.md      # défaut : reprise-corrections-<mode>.md
 *   ... -- --base-url http://localhost:3000   # liens d'édition (défaut : prod)
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
 * Le rapport s'écrit à la fin. Si une application s'interrompt, la relancer :
 * les questions déjà écrites ressortent « déjà propres », mais leur état
 * d'avant n'existe plus que dans l'instantané Neon pris avant.
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
  type FormatIssue,
  type StoredCorrection,
  planCorrection,
} from "../features/questions/normalization"

const BATCH = 200
const DEFAULT_BASE_URL = "https://nomaqbanq.ca"

type Db = ReturnType<typeof drizzle>

export type StoredRow = StoredCorrection & { id: string }

type Action = "write" | "skip" | "review" | "conflict"

export type RepairOutcome = {
  id: string
  /** `conflict` : prévue, mais la question a changé depuis la lecture. */
  action: Action
  before: StoredCorrection
  after?: StoredCorrection
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
): AsyncGenerator<StoredRow[]> {
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
  row: StoredRow,
  next: StoredCorrection,
): Promise<boolean> {
  const storedReferences = questionExplanations.references
  const updated = await db
    .update(questionExplanations)
    .set({ explanation: next.explanation, references: next.references })
    .where(
      and(
        eq(questionExplanations.questionId, row.id),
        eq(questionExplanations.explanation, row.explanation),
        row.references === null
          ? isNull(storedReferences)
          : sql`${storedReferences} = ${JSON.stringify(row.references)}::jsonb`,
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
        references: row.references,
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
      // Une écriture par question : chacune est conditionnée à sa propre
      // valeur lue, ce qu'un UPDATE groupé ne sait pas rapporter ligne à ligne.
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

/**
 * Libellés par action, en passage à blanc puis à l'application. L'ordre des
 * clés est celui du tableau des comptes ; `checkOrder` classe la liste « à
 * vérifier » : ce qui n'a rien reçu d'abord, c'est là que le travail manuel
 * commence.
 */
const ACTIONS: Record<
  Action,
  { checkOrder: number; category: [string, string]; status: [string, string] }
> = {
  write: {
    checkOrder: 2,
    category: ["À mettre en forme", "Mises en forme"],
    status: ["à écrire", "écrite"],
  },
  skip: {
    checkOrder: 3,
    category: ["Déjà propres (sautées)", "Déjà propres (sautées)"],
    status: ["déjà propre", "déjà propre"],
  },
  review: {
    checkOrder: 0,
    category: ["À vérifier, rien écrit", "À vérifier, rien écrit"],
    status: ["rien écrit", "rien écrit"],
  },
  conflict: {
    checkOrder: 1,
    category: [
      "Modifiées depuis la lecture (sautées)",
      "Modifiées depuis la lecture (sautées)",
    ],
    status: ["modifiée depuis la lecture", "modifiée depuis la lecture"],
  },
}

/** Un conflit n'existe qu'à l'application : le passage à blanc n'écrit rien. */
const shownActions = (apply: boolean) =>
  (Object.keys(ACTIONS) as Action[]).filter(
    (action) => apply || action !== "conflict",
  )

export const countByAction = (outcomes: readonly RepairOutcome[]) => {
  const counts: Record<Action, number> = {
    write: 0,
    skip: 0,
    review: 0,
    conflict: 0,
  }
  for (const o of outcomes) counts[o.action]++
  return counts
}

const SAMPLE_COUNT = 5
const SAMPLE_MAX_CHARS = 1500

/** `n` éléments répartis sur toute la liste, pas seulement les premiers ids. */
const spread = <T>(list: readonly T[], n: number): T[] =>
  list.length <= n
    ? [...list]
    : Array.from(
        { length: n },
        (_, i) => list[Math.floor((i * list.length) / n)]!,
      )

const excerpt = (text: string) =>
  text.length > SAMPLE_MAX_CHARS
    ? `${text.slice(0, SAMPLE_MAX_CHARS)}\n… (${text.length} caractères)`
    : text

const fence = (text: string) => ["```text", excerpt(text), "```"].join("\n")

const describeIssue = (issue: FormatIssue) =>
  issue.index === undefined
    ? issue.message
    : `Référence ${issue.index + 1} : ${issue.message}`

const referenceSample = (o: RepairOutcome) => {
  const before = o.before.references ?? []
  const after = o.after!.references ?? []
  return [
    `### ${o.id}`,
    "",
    `Avant : ${before.length} référence(s)`,
    "",
    fence(before.join("\n\n---\n\n")),
    "",
    `Après : ${after.length} référence(s)`,
    "",
    ...after.map((ref, i) => `${i + 1}. ${ref}`),
    "",
  ]
}

const explanationSample = (o: RepairOutcome) => [
  `### ${o.id}`,
  "",
  "Avant :",
  "",
  fence(o.before.explanation),
  "",
  "Après :",
  "",
  fence(o.after!.explanation),
  "",
]

/**
 * Rapport Markdown : comptes par catégorie, échantillons avant/après
 * (découpages et explications), puis la liste « à vérifier » avec motif et
 * lien d'édition.
 */
export function formatReport(
  outcomes: readonly RepairOutcome[],
  meta: { apply: boolean; host: string; date: Date; baseUrl: string },
): string {
  const mode = meta.apply ? 1 : 0
  const counts = countByAction(outcomes)
  const toCheck = outcomes
    .filter((o) => o.issues.length > 0 || o.action === "conflict")
    .sort((a, b) => ACTIONS[a.action].checkOrder - ACTIONS[b.action].checkOrder)
  const written = outcomes.filter((o) => o.action === "write")
  const splits = spread(
    written.filter(
      (o) =>
        (o.after!.references?.length ?? 0) !==
        (o.before.references?.length ?? 0),
    ),
    SAMPLE_COUNT,
  )
  const explanations = spread(
    written.filter((o) => o.after!.explanation !== o.before.explanation),
    SAMPLE_COUNT,
  )
  const lines = [
    `# Reprise des corrections — ${meta.apply ? "application" : "passage à blanc"}`,
    "",
    `Base : \`${meta.host}\` · ${meta.date.toISOString()}`,
    "",
    "| Catégorie | Questions |",
    "| --- | --- |",
    ...shownActions(meta.apply).map(
      (a) => `| ${ACTIONS[a].category[mode]} | ${counts[a]} |`,
    ),
    `| **Total** | ${outcomes.length} |`,
    "",
    `Mise en forme à vérifier : ${toCheck.length} question(s), dont ${toCheck.filter((o) => o.action === "write").length} ${meta.apply ? "écrites" : "à écrire"} quand même (motif de contenu, pas de découpage douteux).`,
    "",
    "## Échantillons avant / après : références",
    "",
    ...(splits.length === 0
      ? ["Aucun découpage.", ""]
      : splits.flatMap(referenceSample)),
    "## Échantillons avant / après : explications",
    "",
    ...(explanations.length === 0
      ? ["Aucune explication remise en forme.", ""]
      : explanations.flatMap(explanationSample)),
    "## Mise en forme à vérifier",
    "",
  ]
  if (toCheck.length === 0) return [...lines, "Aucune.", ""].join("\n")

  return [
    ...lines,
    "| Question | Statut | Motifs |",
    "| --- | --- | --- |",
    ...toCheck.map(
      (o) =>
        `| [${o.id}](${meta.baseUrl}/admin/questions/${o.id}/modifier) | ${ACTIONS[o.action].status[mode]} | ${
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
  const reportPath =
    arg("--report") ??
    `reprise-corrections-${apply ? "application" : "passage-a-blanc"}.md`
  const baseUrl = (arg("--base-url") ?? DEFAULT_BASE_URL).replace(/\/$/, "")
  const host = new URL(url).hostname

  console.log(
    `Cible : ${host} · ${apply ? "APPLICATION (écriture)" : "passage à blanc (aucune écriture)"}${ids ? ` · ${ids.length} question(s)` : ""}`,
  )

  const pool = new Pool({ connectionString: url, max: 2 })
  try {
    const outcomes = await repairCorrections(drizzle(pool), { apply, ids })
    writeFileSync(
      reportPath,
      formatReport(outcomes, { apply, host, date: new Date(), baseUrl }),
    )
    const counts = countByAction(outcomes)
    const mode = apply ? 1 : 0
    console.log(
      `${outcomes.length} question(s) · ${shownActions(apply)
        .map((a) => `${ACTIONS[a].category[mode]} ${counts[a]}`)
        .join(" · ")}`,
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
