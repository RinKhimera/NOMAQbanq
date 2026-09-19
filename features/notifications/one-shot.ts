import {
  type SQL,
  and,
  eq,
  exists,
  getTableColumns,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm"
import type { PgColumn, PgTable } from "drizzle-orm/pg-core"
import "server-only"
import { db } from "@/db"
import { user } from "@/db/schema"
import { captureServerError } from "@/lib/observability"

/**
 * Destinataire éligible : ni supprimé ni suspendu. À appliquer dans le select
 * de tout expéditeur qui joint `user` ; le claim le ré-applique de toute façon,
 * sans poser de marqueur (le courriel repart si la suspension est levée). Les
 * préférences de notification ne sont PAS l'éligibilité.
 */
export const eligibleRecipient: SQL = sql`${user.deletedAt} is null and ${user.banned} = false`

export type OneShotContext = { now: Date; limit: number }

export type OneShotSpec<Row extends { id: string; userId: string }> = {
  /** Étiquette du lot dans l'avertissement de borne ; absente = jamais d'avertissement (expéditeur ciblé, une ligne). */
  label?: string
  /** Tag statique Sentry (« [notif:…] »). */
  tag: string
  limit: number
  /** Candidats ; l'expéditeur y met ses portes métier et `.limit(ctx.limit)`. */
  select: (ctx: OneShotContext) => Promise<Row[]>
  claim: {
    table: PgTable
    /** Colonne comparée à `row.id` (peut vivre sur une autre table que la ligne lue). */
    idColumn: PgColumn
    markerColumn: PgColumn
    /** Plafond : un marqueur plus vieux que ce délai est re-claimé. */
    cooldownMs?: number
    /** Prédicat supplémentaire du claim (ex. « échéance = valeur lue »). */
    guard?: (row: Row) => SQL | undefined
  }
  /** Évalué APRÈS le claim : faux = marqueur posé, pas d'envoi (opt-out sans re-scan). */
  shouldSend?: (row: Row) => boolean
  send: (row: Row) => Promise<unknown>
  context: (row: Row) => { userId?: string; detail?: string }
  now?: Date
}

/**
 * Courriel unique : lecture bornée des candidats, claim atomique du marqueur
 * d'envoi (libre ou plus vieux que le plafond, garde vraie, destinataire
 * éligible), envoi, capture par ligne. Celui qui gagne le claim envoie ; un run
 * concurrent obtient 0 ligne. Le marqueur est posé AVANT l'envoi et jamais
 * retiré sur échec (perte tolérée d'un courriel, jamais de doublon). Renvoie
 * le nombre de courriels envoyés. Jamais appelé dans une transaction. Une
 * erreur de `select` remonte à l'appelant.
 */
export async function sendOnce<Row extends { id: string; userId: string }>(
  spec: OneShotSpec<Row>,
): Promise<number> {
  const now = spec.now ?? new Date()
  const rows = await spec.select({ now, limit: spec.limit })

  if (spec.label && rows.length >= spec.limit) {
    console.warn(
      `[notif] ${spec.label} — borne ${spec.limit} atteinte : le reste sera traité au prochain run`,
    )
  }

  const { table, idColumn, markerColumn, cooldownMs, guard } = spec.claim
  const markerKey = Object.entries(getTableColumns(table)).find(
    ([, column]) => column === markerColumn,
  )?.[0]
  if (!markerKey) {
    throw new Error("sendOnce : markerColumn n'appartient pas à claim.table")
  }
  const free = cooldownMs
    ? or(
        isNull(markerColumn),
        lt(markerColumn, new Date(now.getTime() - cooldownMs)),
      )
    : isNull(markerColumn)

  let sent = 0
  for (const row of rows) {
    try {
      const claimed = await db
        .update(table)
        .set({ [markerKey]: now })
        .where(
          and(
            eq(idColumn, row.id),
            free,
            guard?.(row),
            exists(
              db
                .select({ one: sql`1` })
                .from(user)
                .where(and(eq(user.id, row.userId), eligibleRecipient)),
            ),
          ),
        )
        .returning({ id: idColumn })
      if (claimed.length === 0) continue
      if (spec.shouldSend && !spec.shouldSend(row)) continue

      await spec.send(row)
      sent++
    } catch (error) {
      captureServerError(spec.tag, error, spec.context(row))
    }
  }
  return sent
}
