import { sql } from "drizzle-orm"

/**
 * Libellé de l'objectif d'une question, pour un `select` sur `questions` non
 * aliasée. La corrélation est écrite qualifiée : un `${questions.objectiveId}`
 * serait rendu sans préfixe dans un select mono-table et viserait
 * `cmc_objectives` elle-même.
 */
export const objectiveLabelSql = sql<string>`(
  select "cmc_objectives"."label"
    from "cmc_objectives"
   where "cmc_objectives"."id" = "questions"."objective_id"
)`
