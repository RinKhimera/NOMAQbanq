import { type SQL, type SQLWrapper, sql } from "drizzle-orm"
import "server-only"

/**
 * Score d'une tentative en SQL, l'unique formule de la clôture (`./close.ts`).
 * `round()` sur numeric = half-up exact ; `computeScorePercent` (`lib/score.ts`)
 * en est la jumelle TypeScript, et `tests/integration/score-parity.test.ts`
 * les confronte sur tous les couples (justes, total) jusqu'à 200 questions.
 */
export const scoreSql = (correct: SQLWrapper, total: SQLWrapper): SQL<number> =>
  sql<number>`case when ${total} > 0
    then round(${correct} * 100.0 / ${total})::int
    else 0 end`
