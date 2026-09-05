import { and, eq, gt, isNull, lt, or } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { products, transactions, user } from "@/db/schema"
import { sendAbandonedCartEmail } from "@/email"
import { hasAccess } from "@/features/payments/dal"
import { captureServerError } from "@/lib/observability"

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

// Appelé après le 200 du webhook `checkout.session.expired`. Lectures hors
// transaction ; la seule écriture est le claim par UTILISATEUR, qui porte à la
// fois l'anti-double-envoi et le plafond de 7 jours (deux paniers du même
// utilisateur expirant en même temps ne produisent qu'un courriel).
export async function sendAbandonedCartReminder(
  transactionId: string,
): Promise<boolean> {
  try {
    const [row] = await db
      .select({
        userId: transactions.userId,
        email: user.email,
        name: user.name,
        notifyMarketing: user.notifyMarketing,
        banned: user.banned,
        deletedAt: user.deletedAt,
        anonymizedAt: user.anonymizedAt,
        productName: products.name,
        priceCad: products.priceCad,
        accessType: products.accessType,
        isCombo: products.isCombo,
      })
      .from(transactions)
      .innerJoin(user, eq(user.id, transactions.userId))
      .innerJoin(products, eq(products.id, transactions.productId))
      .where(eq(transactions.id, transactionId))
      .limit(1)
    if (
      !row ||
      !row.notifyMarketing ||
      row.banned ||
      row.deletedAt ||
      row.anonymizedAt
    ) {
      return false
    }

    // Un combo garde de la valeur tant qu'un des deux accès manque.
    const targetTypes: ("exam" | "training")[] = row.isCombo
      ? ["exam", "training"]
      : [row.accessType]
    const active = await Promise.all(
      targetTypes.map((type) => hasAccess(type, row.userId)),
    )
    if (active.every(Boolean)) return false

    const since = new Date(Date.now() - COOLDOWN_MS)
    const [recentPurchase] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, row.userId),
          eq(transactions.status, "completed"),
          gt(transactions.completedAt, since),
        ),
      )
      .limit(1)
    if (recentPurchase) return false

    const claimed = await db
      .update(user)
      .set({ cartReminderSentAt: new Date() })
      .where(
        and(
          eq(user.id, row.userId),
          or(
            isNull(user.cartReminderSentAt),
            lt(user.cartReminderSentAt, since),
          ),
        ),
      )
      .returning({ id: user.id })
    if (claimed.length === 0) return false

    await sendAbandonedCartEmail({
      to: row.email,
      name: row.name,
      userId: row.userId,
      productName: row.productName,
      priceCad: row.priceCad,
    })
    return true
  } catch (error) {
    captureServerError("[notif:panier]", error, {
      detail: `transaction ${transactionId}`,
    })
    return false
  }
}
