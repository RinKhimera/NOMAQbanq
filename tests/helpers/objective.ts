import { db } from "@/db"
import { cmcObjectives } from "@/db/schema"

/**
 * Objectif semé par `vitest.setup.integration.ts` : les fabriques de question
 * synchrones s'en servent quand l'objectif n'est pas le sujet du test.
 */
export const TEST_OBJECTIVE_ID = "test-objective"
export const TEST_OBJECTIVE_LABEL = "Objectif de test"

export const seedTestObjective = () =>
  db
    .insert(cmcObjectives)
    .values({ id: TEST_OBJECTIVE_ID, label: TEST_OBJECTIVE_LABEL })
    .onConflictDoNothing()

/**
 * Objectif du référentiel de ce libellé, créé au besoin. Les fixtures de
 * question en ont besoin : `questions.objective_id` est obligatoire.
 */
export const objectiveIdFor = async (
  label: string,
  opts: { needsFix?: boolean } = {},
): Promise<string> => {
  const [row] = await db
    .insert(cmcObjectives)
    .values({ label, needsFix: opts.needsFix ?? false })
    .onConflictDoUpdate({
      target: cmcObjectives.label,
      set: { needsFix: opts.needsFix ?? false },
    })
    .returning({ id: cmcObjectives.id })
  return row!.id
}
