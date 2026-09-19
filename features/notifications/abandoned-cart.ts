import { and, eq, gt } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { products, transactions, user } from "@/db/schema"
import { sendAbandonedCartEmail } from "@/email"
import { hasAccess } from "@/features/payments/dal"
import { captureServerError } from "@/lib/observability"
import { eligibleRecipient, sendOnce } from "./one-shot"

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

// Appelé après le 200 du webhook `checkout.session.expired`. La ligne lue est
// la transaction, mais le marqueur vit sur l'UTILISATEUR (`row.id` = userId) :
// le claim porte à la fois l'anti-double-envoi et le plafond de 7 jours (deux
// paniers du même utilisateur expirant en même temps ne produisent qu'un
// courriel). Les portes métier (accès déjà actif, achat récent) courent dans
// le select, AVANT le claim : un silence ne consomme pas le plafond.
export async function sendAbandonedCartReminder(
  transactionId: string,
): Promise<boolean> {
  try {
    const sent = await sendOnce({
      tag: "[notif:panier]",
      limit: 1,
      select: async ({ now, limit }) => {
        const [row] = await db
          .select({
            id: transactions.userId,
            userId: transactions.userId,
            email: user.email,
            name: user.name,
            productName: products.name,
            priceCad: products.priceCad,
            accessType: products.accessType,
            isCombo: products.isCombo,
          })
          .from(transactions)
          .innerJoin(user, eq(user.id, transactions.userId))
          .innerJoin(products, eq(products.id, transactions.productId))
          .where(
            and(
              eq(transactions.id, transactionId),
              eq(user.notifyMarketing, true),
              eligibleRecipient,
            ),
          )
          .limit(limit)
        if (!row) return []

        // Un combo garde de la valeur tant qu'un des deux accès manque.
        const targetTypes: ("exam" | "training")[] = row.isCombo
          ? ["exam", "training"]
          : [row.accessType]
        const active = await Promise.all(
          targetTypes.map((type) => hasAccess(type, row.userId)),
        )
        if (active.every(Boolean)) return []

        const [recentPurchase] = await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, row.userId),
              eq(transactions.status, "completed"),
              gt(
                transactions.completedAt,
                new Date(now.getTime() - COOLDOWN_MS),
              ),
            ),
          )
          .limit(1)
        return recentPurchase ? [] : [row]
      },
      claim: {
        table: user,
        idColumn: user.id,
        markerColumn: user.cartReminderSentAt,
        cooldownMs: COOLDOWN_MS,
      },
      send: (r) =>
        sendAbandonedCartEmail({
          to: r.email,
          name: r.name,
          userId: r.userId,
          productName: r.productName,
          priceCad: r.priceCad,
        }),
      context: () => ({ detail: `transaction ${transactionId}` }),
    })
    return sent > 0
  } catch (error) {
    captureServerError("[notif:panier]", error, {
      detail: `transaction ${transactionId}`,
    })
    return false
  }
}
