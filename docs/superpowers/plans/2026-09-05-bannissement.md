# Bannissement et retrait d'accès après remboursement — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un admin de suspendre un compte (réversible, journalisé) et retirer automatiquement l'accès d'une transaction Stripe remboursée ou dont le litige est perdu.

**Architecture:** Le drapeau `user.banned` reste le verrou lu par le plugin admin de Better Auth ; une table `user_bans` porte l'historique. Deux Server Actions (`banUser`, `unbanUser`) calquées sur `updateUserRole`, `getCurrentSession` qui renvoie `null` pour un banni, une page publique `/compte-suspendu`. Côté paiements, `refundStripeTransaction` passe une transaction `completed` en `refunded` puis rejoue `recomputeAccess`, appelée par le webhook sur `charge.refunded` (complet) et `charge.dispute.closed` (`lost`).

**Tech Stack:** Next.js 16 App Router, Drizzle + Neon, Better Auth 1.7 (plugin admin), Stripe SDK, Vitest (happy-dom + projet `integration` sur branche Neon éphémère), shadcn/ui, motion/react.

**Spec :** `docs/superpowers/specs/2026-09-05-bannissement-design.md`.

**Contexte d'exécution :** worktree `C:\Users\samue\Downloads\Code\NOMAqBANK-bannissement`, branche `feat/bannissement`. Toutes les commandes se lancent depuis ce dossier. Commits conventionnels, **sans attribution Claude** (règle globale de l'utilisateur). `bun run test` (jamais `bun test`) ; les tests d'intégration via `bun run test:integration -- tests/integration/<fichier>` (crée, migre et détruit une branche Neon : ~2 min de mise en route). Avant chaque commit : `bun run check`.

---

## Carte des fichiers

| Fichier | Rôle |
| --- | --- |
| `db/schema/auth.ts` (modif) | table `userBans` + relation |
| `db/schema/payments.ts` (modif) | colonne `refundedAt` |
| `drizzle/0017_*.sql` (généré) | migration |
| `features/users/schemas.ts` (modif) | `banUserSchema`, `unbanUserSchema` |
| `features/users/actions.ts` (modif) | `banUser`, `unbanUser`, helper de verrou partagé |
| `features/users/dal.ts` (modif) | `banned` sur les vues admin, `getUserBans` |
| `features/notifications/cron.ts` (modif) | exclusion des bannis |
| `lib/dal.ts` (modif) | `getCurrentSession` → `null` si banni |
| `lib/auth.ts` (modif) | `bannedUserMessage` FR |
| `lib/auth-errors.ts` (modif) | kind `banned` |
| `app/(auth)/connexion/_components/sign-in-form.tsx` (modif) | redirection + `errorCallbackURL` |
| `app/(auth)/connexion/_components/oauth-error-handler.tsx` (créé) | lecture de `?error=` |
| `app/(auth)/connexion/page.tsx` (modif) | monte le handler dans `<Suspense>` |
| `app/(auth)/inscription/_components/sign-up-form.tsx` (modif) | `errorCallbackURL` |
| `app/(auth)/compte-suspendu/page.tsx` (créé) | page publique |
| `features/payments/stripe.ts` (modif) | `refundStripeTransaction` |
| `features/payments/actions.ts` (modif) | `refundedAt` sur transition manuelle |
| `app/api/stripe/webhook/route.ts` (modif) | `charge.refunded`, branche `lost` |
| `app/(admin)/admin/utilisateurs/[id]/_components/user-ban-section.tsx` (créé) | section admin |
| `app/(admin)/admin/utilisateurs/[id]/page.tsx`, `user-detail-client.tsx` (modif) | câblage |
| `app/(admin)/admin/utilisateurs/_components/users-table.tsx` (modif) | badge « Suspendu » |
| `.claude/rules/payments.md`, `.claude/rules/data-layer.md` (modif) | doctrine |
| Tests | `tests/integration/users-ban.test.ts`, `tests/integration/payments-refund.test.ts`, `tests/integration/notifications-cron.test.ts`, `tests/lib/dal.test.ts`, `tests/lib/auth-errors.test.ts`, `tests/components/auth/sign-in-form.test.tsx`, `tests/components/auth/oauth-error-handler.test.tsx`, `tests/components/auth/suspended-page.test.tsx`, `tests/features/stripe-webhook-errors.test.ts`, `tests/components/admin/UserBanSection.test.tsx` |

---

### Task 1 : Schéma et migration

**Files:**
- Modify: `db/schema/auth.ts`
- Modify: `db/schema/payments.ts:111` (après `completedAt`)
- Create (généré): `drizzle/0017_user_bans.sql`

- [ ] **Step 1 : Ajouter la table `userBans` dans `db/schema/auth.ts`**

Imports en tête de fichier : ajouter `sql` à l'import `drizzle-orm` et `createId` :

```ts
import { relations, sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { createId } from "@/lib/ids"
import { userRole } from "./enums"
```

Après la table `rateLimit`, avant `userRelations` :

```ts
// Journal des suspensions. `user.banned` / `user.ban_reason` restent le verrou
// lu par le plugin admin de Better Auth ; cette table est l'historique (qui,
// quand, pourquoi, levée par qui). L'index unique partiel garantit au plus un
// épisode ouvert par compte sous deux clics concurrents.
export const userBans = pgTable(
  "user_bans",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    // `set null` : la suppression du compte admin ne doit pas bloquer sur un
    // ban qu'il a prononcé ; la ligne survit, l'auteur se lit « supprimé ».
    bannedBy: text("banned_by").references(() => user.id, {
      onDelete: "set null",
    }),
    bannedAt: timestamp("banned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    liftedBy: text("lifted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    liftedAt: timestamp("lifted_at", { withTimezone: true }),
    liftReason: text("lift_reason"),
  },
  (t) => [
    index("user_bans_user_id_idx").on(t.userId),
    uniqueIndex("user_bans_active_uidx")
      .on(t.userId)
      .where(sql`${t.liftedAt} is null`),
  ],
)
```

Et dans `userRelations` :

```ts
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  bans: many(userBans),
}))

export const userBansRelations = relations(userBans, ({ one }) => ({
  user: one(user, { fields: [userBans.userId], references: [user.id] }),
}))
```

- [ ] **Step 2 : Ajouter `refundedAt` dans `db/schema/payments.ts`**

Juste après `completedAt` dans la table `transactions` :

```ts
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Date du retour de fonds (événement Stripe ou transition manuelle) ; nul
    // tant que la transaction n'est pas `refunded`.
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
```

- [ ] **Step 3 : Générer la migration**

Run: `bunx drizzle-kit generate --name user_bans`
Expected: `drizzle/0017_user_bans.sql` créé. Ouvrir le fichier et vérifier qu'il contient exactement : `CREATE TABLE "user_bans"` (8 colonnes), `ALTER TABLE "transactions" ADD COLUMN "refunded_at" timestamp with time zone`, deux `ADD CONSTRAINT ... FOREIGN KEY` pour `banned_by` / `lifted_by` en `ON DELETE set null`, un pour `user_id` en `ON DELETE cascade`, `CREATE INDEX "user_bans_user_id_idx"`, `CREATE UNIQUE INDEX "user_bans_active_uidx" ON "user_bans" USING btree ("user_id") WHERE "user_bans"."lifted_at" is null`. Rien d'autre (aucun `DROP`, aucune autre table touchée).

- [ ] **Step 4 : Type-check**

Run: `bunx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5 : Appliquer sur la base de développement**

Run: `bun run db:migrate`
Expected: `[✓] migrations applied successfully!` (cible `DATABASE_URL_UNPOOLED` de `.env.local`, branche Neon develop).

- [ ] **Step 6 : Commit**

```bash
git add db/schema/auth.ts db/schema/payments.ts drizzle/
git commit -m "feat(db): journal des suspensions et date de remboursement"
```

---

### Task 2 : Server Actions `banUser` / `unbanUser`

**Files:**
- Modify: `features/users/schemas.ts` (fin de fichier)
- Modify: `features/users/actions.ts`
- Create: `tests/integration/users-ban.test.ts`

- [ ] **Step 1 : Schémas zod**

À la fin de `features/users/schemas.ts` :

```ts
export const banUserSchema = z.object({
  userId: z.string().min(1, "Utilisateur requis"),
  reason: z
    .string()
    .trim()
    .min(5, "Le motif doit contenir au moins 5 caractères")
    .max(500, "Le motif ne peut pas dépasser 500 caractères"),
})

export const unbanUserSchema = z.object({
  userId: z.string().min(1, "Utilisateur requis"),
  reason: z
    .string()
    .trim()
    .max(500, "Le motif ne peut pas dépasser 500 caractères")
    .optional(),
})
```

- [ ] **Step 2 : Écrire le test d'intégration (échoue : actions inexistantes)**

Créer `tests/integration/users-ban.test.ts` :

```ts
import { and, eq, inArray, isNull } from "drizzle-orm"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { db } from "@/db"
import {
  products,
  session as sessionTable,
  transactions,
  user,
  userAccess,
  userBans,
} from "@/db/schema"
import { hasAccess } from "@/features/payments/dal"
import { banUser, unbanUser } from "@/features/users/actions"
import { anonymizeExpiredDeletedAccounts } from "@/features/users/cron"
import { getUserBans, getUserForAdmin } from "@/features/users/dal"
import { DELETION_GRACE_MS } from "@/features/users/lib/account-deletion"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { captureServerError } from "@/lib/observability"

// Guards mockés, base réelle : le re-check transactionnel lit la vraie base —
// c'est lui qu'on teste. Le stub de @/lib/auth évite de charger Better Auth.
vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))
vi.mock("@/lib/auth-guards", () => ({
  requireSession: vi.fn(),
  requireRole: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({ headers: vi.fn() }))
vi.mock("@/lib/observability", () => ({ captureServerError: vi.fn() }))
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)
const adminId = createId()
const otherAdminId = createId()
const ghostAdminId = createId() // sera anonymisé par le cron dans un test
const targetId = createId()
const bystanderId = createId()
const productId = createId()
const txId = createId()
const FIXTURE_IDS = [adminId, otherAdminId, ghostAdminId, targetId, bystanderId]

const mockCaller = (id = adminId) =>
  vi.mocked(requireRole).mockResolvedValue({
    user: { id, email: `x-${id}@test.invalid`, role: "admin" },
    session: { id: createId() },
  } as never)

const readUser = async (id: string) => {
  const [row] = await db
    .select({ banned: user.banned, banReason: user.banReason })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)
  return row
}

const sessionsOf = (userId: string) =>
  db
    .select({ id: sessionTable.id })
    .from(sessionTable)
    .where(eq(sessionTable.userId, userId))

const bansOf = (userId: string) =>
  db.select().from(userBans).where(eq(userBans.userId, userId))

const seedSession = (userId: string) =>
  db.insert(sessionTable).values({
    id: createId(),
    token: createId(),
    userId,
    expiresAt: new Date(Date.now() + DAY),
    updatedAt: new Date(),
  })

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: adminId,
      name: "Admin Ban",
      email: `ban-admin-${suffix}@test.invalid`,
      role: "admin",
    },
    {
      id: otherAdminId,
      name: "Autre Admin",
      email: `ban-admin2-${suffix}@test.invalid`,
      role: "admin",
    },
    {
      id: ghostAdminId,
      name: "Admin Fantôme",
      email: `ban-ghost-${suffix}@test.invalid`,
      role: "admin",
    },
    {
      id: targetId,
      name: "Cible Ban",
      email: `ban-target-${suffix}@test.invalid`,
    },
    {
      id: bystanderId,
      name: "Témoin",
      email: `ban-bystander-${suffix}@test.invalid`,
    },
  ])
  await db.insert(products).values({
    id: productId,
    code: "exam_access",
    name: "Exam",
    description: "d",
    priceCad: 5000,
    durationDays: 30,
    accessType: "exam",
    stripeProductId: `prod_ban_${suffix}`,
    stripePriceId: `price_ban_${suffix}`,
    stripePriceLookupKey: `price_ban_${suffix}`,
  })
  await db.insert(transactions).values({
    id: txId,
    userId: targetId,
    productId,
    type: "manual",
    status: "completed",
    amountPaid: 5000,
    currency: "CAD",
    accessType: "exam",
    durationDays: 30,
    accessExpiresAt: new Date(Date.now() + 30 * DAY),
    completedAt: new Date(),
  })
  await db.insert(userAccess).values({
    userId: targetId,
    accessType: "exam",
    expiresAt: new Date(Date.now() + 30 * DAY),
    lastTransactionId: txId,
  })
})

afterAll(async () => {
  await db.delete(userAccess).where(eq(userAccess.userId, targetId))
  await db.delete(transactions).where(eq(transactions.id, txId))
  await db.delete(products).where(eq(products.id, productId))
  for (const id of FIXTURE_IDS) {
    await db.delete(user).where(eq(user.id, id))
  }
})

beforeEach(async () => {
  vi.mocked(captureServerError).mockClear()
  // Nettoyage borné aux fixtures (jamais de DELETE de table entière, même sur
  // une branche jetable : le fichier doit rester sûr en `test:integration:keep`).
  await db.delete(userBans).where(inArray(userBans.userId, FIXTURE_IDS))
  await db.delete(sessionTable).where(eq(sessionTable.userId, targetId))
  await db.delete(sessionTable).where(eq(sessionTable.userId, bystanderId))
  await db
    .update(user)
    .set({ role: "admin", deletedAt: null, banned: false, banReason: null })
    .where(eq(user.id, adminId))
  await db
    .update(user)
    .set({ role: "user", deletedAt: null, banned: false, banReason: null })
    .where(eq(user.id, targetId))
  mockCaller()
})

describe("banUser", () => {
  it("pose le drapeau, journalise, supprime les sessions de la cible seulement, garde l'accès", async () => {
    await seedSession(targetId)
    await seedSession(targetId)
    await seedSession(bystanderId)

    const result = await banUser({ userId: targetId, reason: "Litige perdu, fraude" })
    expect(result).toEqual({ success: true })

    expect(await readUser(targetId)).toEqual({
      banned: true,
      banReason: "Litige perdu, fraude",
    })
    const bans = await bansOf(targetId)
    expect(bans).toHaveLength(1)
    expect(bans[0]).toMatchObject({
      reason: "Litige perdu, fraude",
      bannedBy: adminId,
      liftedAt: null,
      liftedBy: null,
    })
    expect(await sessionsOf(targetId)).toHaveLength(0)
    expect(await sessionsOf(bystanderId)).toHaveLength(1)
    expect(await hasAccess("exam", targetId)).toBe(true)
  })

  it("refuse l'auto-suspension", async () => {
    const result = await banUser({ userId: adminId, reason: "Motif suffisant" })
    expect(result).toEqual({
      success: false,
      error: "Vous ne pouvez pas suspendre votre propre compte.",
    })
    expect((await readUser(adminId))?.banned).toBe(false)
  })

  it("refuse de suspendre un admin", async () => {
    await db.update(user).set({ role: "admin" }).where(eq(user.id, targetId))
    const result = await banUser({ userId: targetId, reason: "Motif suffisant" })
    expect(result).toEqual({
      success: false,
      error: "Retirez d'abord le rôle administrateur de ce compte.",
    })
    expect(await bansOf(targetId)).toHaveLength(0)
  })

  it("refuse une cible supprimée ou inconnue", async () => {
    await db
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, targetId))
    expect(await banUser({ userId: targetId, reason: "Motif suffisant" })).toEqual({
      success: false,
      error: "Utilisateur introuvable.",
    })
    expect(await banUser({ userId: createId(), reason: "Motif suffisant" })).toEqual({
      success: false,
      error: "Utilisateur introuvable.",
    })
  })

  it("refuse un compte déjà suspendu", async () => {
    await banUser({ userId: targetId, reason: "Premier motif" })
    const result = await banUser({ userId: targetId, reason: "Second motif" })
    expect(result).toEqual({
      success: false,
      error: "Ce compte est déjà suspendu.",
    })
    expect(await bansOf(targetId)).toHaveLength(1)
  })

  it("refuse si l'appelant n'est plus admin en base (re-check transactionnel)", async () => {
    await db.update(user).set({ role: "user" }).where(eq(user.id, adminId))
    const result = await banUser({ userId: targetId, reason: "Motif suffisant" })
    expect(result).toEqual({
      success: false,
      error: "Votre compte n'a plus les droits administrateur.",
    })
    expect((await readUser(targetId))?.banned).toBe(false)
  })

  it("refuse un motif trop court (zod)", async () => {
    const result = await banUser({ userId: targetId, reason: "abc" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Le motif doit contenir au moins 5 caractères")
  })

  it("sérialise deux suspensions concurrentes : un seul épisode", async () => {
    const [a, b] = await Promise.all([
      banUser({ userId: targetId, reason: "Motif A concurrent" }),
      banUser({ userId: targetId, reason: "Motif B concurrent" }),
    ])
    const results = [a, b]
    expect(results.filter((r) => r.success)).toHaveLength(1)
    expect(results.find((r) => !r.success)?.error).toBe(
      "Ce compte est déjà suspendu.",
    )
    expect(await bansOf(targetId)).toHaveLength(1)
  })
})

describe("unbanUser", () => {
  it("clôt l'épisode, efface le drapeau, l'accès est identique", async () => {
    await banUser({ userId: targetId, reason: "Litige perdu, fraude" })
    mockCaller(otherAdminId)

    const result = await unbanUser({ userId: targetId, reason: "Erreur de manipulation" })
    expect(result).toEqual({ success: true })

    expect(await readUser(targetId)).toEqual({ banned: false, banReason: null })
    const [ban] = await bansOf(targetId)
    expect(ban).toMatchObject({
      bannedBy: adminId,
      liftedBy: otherAdminId,
      liftReason: "Erreur de manipulation",
    })
    expect(ban?.liftedAt).toBeInstanceOf(Date)
    expect(await hasAccess("exam", targetId)).toBe(true)
  })

  it("refuse un compte non suspendu", async () => {
    const result = await unbanUser({ userId: targetId })
    expect(result).toEqual({
      success: false,
      error: "Ce compte n'est pas suspendu.",
    })
  })

  it("refuse l'auto-levée", async () => {
    const result = await unbanUser({ userId: adminId })
    expect(result).toEqual({
      success: false,
      error: "Vous ne pouvez pas lever votre propre suspension.",
    })
  })

  it("lève un drapeau sans journal et capture l'incohérence", async () => {
    await db
      .update(user)
      .set({ banned: true, banReason: "posé à la main" })
      .where(eq(user.id, targetId))

    const result = await unbanUser({ userId: targetId })
    expect(result).toEqual({ success: true })
    expect(await readUser(targetId)).toEqual({ banned: false, banReason: null })
    expect(captureServerError).toHaveBeenCalledWith(
      "[unbanUser]",
      expect.any(Error),
      { userId: targetId },
    )
  })

  it("après levée, une nouvelle suspension ouvre un second épisode", async () => {
    await banUser({ userId: targetId, reason: "Premier épisode" })
    await unbanUser({ userId: targetId })
    const result = await banUser({ userId: targetId, reason: "Second épisode" })
    expect(result).toEqual({ success: true })
    const open = await db
      .select()
      .from(userBans)
      .where(and(eq(userBans.userId, targetId), isNull(userBans.liftedAt)))
    expect(open).toHaveLength(1)
    expect(open[0]?.reason).toBe("Second épisode")
    expect(await bansOf(targetId)).toHaveLength(2)
  })
})

describe("DAL admin", () => {
  it("getUserForAdmin expose `banned`", async () => {
    expect((await getUserForAdmin(targetId))?.banned).toBe(false)
    await banUser({ userId: targetId, reason: "Motif suffisant" })
    expect((await getUserForAdmin(targetId))?.banned).toBe(true)
  })

  it("getUserBans : ordre décroissant, noms des admins", async () => {
    await banUser({ userId: targetId, reason: "Premier épisode" })
    mockCaller(otherAdminId)
    await unbanUser({ userId: targetId, reason: "Levée" })
    mockCaller(adminId)
    await banUser({ userId: targetId, reason: "Second épisode" })

    const bans = await getUserBans(targetId)
    expect(bans.map((b) => b.reason)).toEqual(["Second épisode", "Premier épisode"])
    expect(bans[0]).toMatchObject({
      bannedByName: "Admin Ban",
      liftedAt: null,
      liftedByName: null,
      liftReason: null,
    })
    expect(bans[1]).toMatchObject({
      bannedByName: "Admin Ban",
      liftedByName: "Autre Admin",
      liftReason: "Levée",
    })
    expect(typeof bans[0]?.bannedAt).toBe("number")
    expect(typeof bans[1]?.liftedAt).toBe("number")
  })

  it("getUserBans : borné à 20 épisodes, les plus récents", async () => {
    const base = Date.now() - 100 * 24 * 60 * 60 * 1000
    await db.insert(userBans).values(
      Array.from({ length: 25 }, (_, i) => ({
        userId: targetId,
        reason: `Épisode ${i}`,
        bannedBy: adminId,
        bannedAt: new Date(base + i * 60_000),
        liftedBy: adminId,
        liftedAt: new Date(base + i * 60_000 + 30_000),
      })),
    )
    const bans = await getUserBans(targetId)
    expect(bans).toHaveLength(20)
    expect(bans[0]?.reason).toBe("Épisode 24")
    expect(bans[19]?.reason).toBe("Épisode 5")
  })

  it("auteur anonymisé par le cron : le nom joint devient « Utilisateur supprimé »", async () => {
    // Aucun chemin produit ne supprime une ligne `user` (anonymisation par
    // UPDATE) : c'est le seul scénario « auteur disparu » atteignable.
    mockCaller(ghostAdminId)
    await banUser({ userId: targetId, reason: "Motif du fantôme" })
    await db
      .update(user)
      .set({ deletedAt: new Date(Date.now() - DELETION_GRACE_MS - 60_000) })
      .where(eq(user.id, ghostAdminId))
    await anonymizeExpiredDeletedAccounts()

    const [ban] = await getUserBans(targetId)
    expect(ban?.bannedByName).toBe("Utilisateur supprimé")
  })
})
```

- [ ] **Step 3 : Lancer le test pour le voir échouer**

Run: `bun run test:integration -- tests/integration/users-ban.test.ts`
Expected: échec à l'import (`banUser`, `unbanUser`, `getUserBans` non exportés).

- [ ] **Step 4 : Implémenter les actions**

Dans `features/users/actions.ts`, mettre à jour les imports :

```ts
import { and, eq, inArray, isNull, ne } from "drizzle-orm"
...
import { session as sessionTable, user, userBans } from "@/db/schema"
...
import {
  banUserSchema,
  profileSchema,
  unbanUserSchema,
  updateUserRoleSchema,
} from "@/features/users/schemas"
```

Ajouter, juste avant `updateUserRole`, le helper de verrou (non exporté : un fichier `"use server"` n'exporte que des fonctions async) :

```ts
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

type LockedUser = {
  id: string
  role: "user" | "admin"
  deletedAt: Date | null
  banned: boolean
}

// Un seul SELECT ... FOR UPDATE trié par id : verrouille appelant + cible
// dans un ordre déterministe (pas de deadlock entre deux appels croisés) et
// re-vérifie que l'appelant est encore admin actif SOUS verrou — requireRole
// est hors transaction, l'appelant a pu être rétrogradé entre-temps.
const lockCallerAndTarget = async (
  tx: Tx,
  callerId: string,
  targetId: string,
): Promise<
  | { ok: true; target: LockedUser }
  | { ok: false; error: string }
> => {
  const rows = await tx
    .select({
      id: user.id,
      role: user.role,
      deletedAt: user.deletedAt,
      banned: user.banned,
    })
    .from(user)
    .where(inArray(user.id, [callerId, targetId]))
    .orderBy(user.id)
    .for("update")

  const caller = rows.find((r) => r.id === callerId)
  if (!caller || caller.role !== "admin" || caller.deletedAt !== null) {
    return { ok: false, error: "Votre compte n'a plus les droits administrateur." }
  }
  const target = rows.find((r) => r.id === targetId)
  if (!target || target.deletedAt !== null) {
    return { ok: false, error: "Utilisateur introuvable." }
  }
  return { ok: true, target }
}
```

Réécrire le corps transactionnel de `updateUserRole` avec ce helper. Conserver
tel quel le commentaire de tête de la fonction (« Invariant "jamais zéro admin
actif"… ») ; seul le commentaire interne sur le `SELECT ... FOR UPDATE` migre
dans le helper. Un ajout de comportement : un compte suspendu ne peut pas
devenir admin (un admin suspendu ne peut pas se connecter et fausserait le
décompte des admins utilisables).

```ts
  const result = await db.transaction(async (tx) => {
    const locked = await lockCallerAndTarget(tx, authSession.user.id, targetId)
    if (!locked.ok) return locked
    if (role === "admin" && locked.target.banned) {
      return {
        ok: false as const,
        error: "Levez d'abord la suspension de ce compte.",
      }
    }
    if (locked.target.role !== role) {
      await tx.update(user).set({ role }).where(eq(user.id, targetId))
    }
    return { ok: true as const }
  })
```

Dans `deleteMyAccount`, un admin suspendu ne compte pas comme « autre admin »
(il ne peut pas se connecter, donc pas lever la suspension ni administrer) :

```ts
      const admins = await tx
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            eq(user.role, "admin"),
            isNull(user.deletedAt),
            eq(user.banned, false),
          ),
        )
        .orderBy(user.id)
        .for("update")
```

Tests de ces deux gardes. Dans `tests/integration/users-role.test.ts`, après
« refuse une cible soft-deleted » :

```ts
  it("refuse de promouvoir un compte suspendu", async () => {
    await db
      .update(user)
      .set({ banned: true, banReason: "test" })
      .where(eq(user.id, targetId))
    const result = await updateUserRole({ userId: targetId, role: "admin" })
    expect(result).toEqual({
      success: false,
      error: "Levez d'abord la suspension de ce compte.",
    })
    expect(await getRole(targetId)).toBe("user")
    await db
      .update(user)
      .set({ banned: false, banReason: null })
      .where(eq(user.id, targetId))
  })
```

Dans `tests/integration/users-account.test.ts`, dans le `describe("deleteMyAccount — garde dernier admin")`,
même hermétisme que le cas « seul admin actif » (d'autres fichiers créent des admins) :

```ts
  it("un admin suspendu ne compte pas comme « autre admin »", async () => {
    const adminA = createId()
    const bannedB = createId()
    const emailA = `admin-a-${adminA}@test.invalid`
    await db.insert(user).values([
      { id: adminA, name: "Admin A", email: emailA, role: "admin" },
      {
        id: bannedB,
        name: "Admin B suspendu",
        email: `admin-b-${bannedB}@test.invalid`,
        role: "admin",
        banned: true,
        banReason: "test",
      },
    ])
    const otherUsableAdmins = await db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          eq(user.role, "admin"),
          isNull(user.deletedAt),
          eq(user.banned, false),
          ne(user.id, adminA),
        ),
      )
    vi.mocked(requireSession).mockResolvedValueOnce({
      user: { id: adminA, email: emailA, role: "admin" },
      session: { id: createId() },
    } as never)

    const res = await deleteMyAccount({ confirmEmail: emailA })
    // B est admin mais suspendu : il ne sauve pas A. Le refus n'est dû que si
    // aucun autre admin utilisable n'existe dans la base à cet instant.
    expect(res.success).toBe(otherUsableAdmins.length > 0)

    await db.delete(session).where(eq(session.userId, adminA))
    await db.delete(user).where(eq(user.id, adminA))
    await db.delete(user).where(eq(user.id, bannedB))
  })
```

(`ne` s'ajoute à l'import `drizzle-orm` de ce fichier s'il n'y est pas.)

Puis ajouter après `updateUserRole` :

```ts
// [Admin] Suspend un compte : journal + drapeau lu par le plugin admin de
// Better Auth + suppression de toutes ses sessions (le plugin ne revérifie
// jamais une session existante). Accès et transactions intacts : la levée
// restaure l'état exact. Un admin se rétrograde avant d'être suspendu, ce qui
// règle « dernier admin » sans compteur, comme updateUserRole.
export const banUser = async (input: {
  userId: string
  reason: string
}): Promise<AccountActionResult> => {
  const authSession = await requireRole(["admin"])

  const parsed = banUserSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides",
    }
  }
  const { userId: targetId, reason } = parsed.data

  if (targetId === authSession.user.id) {
    return {
      success: false,
      error: "Vous ne pouvez pas suspendre votre propre compte.",
    }
  }

  let result: { ok: true } | { ok: false; error: string }
  try {
    result = await db.transaction(async (tx) => {
      const locked = await lockCallerAndTarget(tx, authSession.user.id, targetId)
      if (!locked.ok) return locked
      if (locked.target.role === "admin") {
        return {
          ok: false as const,
          error: "Retirez d'abord le rôle administrateur de ce compte.",
        }
      }
      if (locked.target.banned) {
        return { ok: false as const, error: "Ce compte est déjà suspendu." }
      }

      await tx.insert(userBans).values({
        userId: targetId,
        reason,
        bannedBy: authSession.user.id,
      })
      await tx
        .update(user)
        .set({ banned: true, banReason: reason })
        .where(eq(user.id, targetId))
      await tx.delete(sessionTable).where(eq(sessionTable.userId, targetId))
      return { ok: true as const }
    })
  } catch (error) {
    // Course perdue sur l'index unique partiel : pas une anomalie.
    if (isPgUniqueViolation(error)) {
      return { success: false, error: "Ce compte est déjà suspendu." }
    }
    captureServerError("[banUser]", error, { userId: authSession.user.id })
    return { success: false, error: "Erreur serveur. Réessayez." }
  }

  if (!result.ok) return { success: false, error: result.error }

  revalidatePath("/admin/utilisateurs")
  revalidatePath(`/admin/utilisateurs/${targetId}`)
  return { success: true }
}

// [Admin] Lève une suspension : clôt l'épisode ouvert du journal, efface le
// drapeau. Un drapeau sans épisode ouvert (état incohérent) est levé quand
// même et signalé : un journal cassé ne doit pas bloquer la levée.
export const unbanUser = async (input: {
  userId: string
  reason?: string
}): Promise<AccountActionResult> => {
  const authSession = await requireRole(["admin"])

  const parsed = unbanUserSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides",
    }
  }
  const { userId: targetId } = parsed.data
  const liftReason = parsed.data.reason ? parsed.data.reason : null

  if (targetId === authSession.user.id) {
    return {
      success: false,
      error: "Vous ne pouvez pas lever votre propre suspension.",
    }
  }

  let result: { ok: true; journalMissing: boolean } | { ok: false; error: string }
  try {
    result = await db.transaction(async (tx) => {
      const locked = await lockCallerAndTarget(tx, authSession.user.id, targetId)
      if (!locked.ok) return locked
      if (!locked.target.banned) {
        return { ok: false as const, error: "Ce compte n'est pas suspendu." }
      }

      const closed = await tx
        .update(userBans)
        .set({
          liftedBy: authSession.user.id,
          liftedAt: new Date(),
          liftReason,
        })
        .where(and(eq(userBans.userId, targetId), isNull(userBans.liftedAt)))
        .returning({ id: userBans.id })
      await tx
        .update(user)
        .set({ banned: false, banReason: null })
        .where(eq(user.id, targetId))
      return { ok: true as const, journalMissing: closed.length === 0 }
    })
  } catch (error) {
    captureServerError("[unbanUser]", error, { userId: authSession.user.id })
    return { success: false, error: "Erreur serveur. Réessayez." }
  }

  if (!result.ok) return { success: false, error: result.error }
  if (result.journalMissing) {
    captureServerError(
      "[unbanUser]",
      new Error("suspension levée sans épisode ouvert dans user_bans"),
      { userId: targetId },
    )
  }

  revalidatePath("/admin/utilisateurs")
  revalidatePath(`/admin/utilisateurs/${targetId}`)
  return { success: true }
}
```

- [ ] **Step 5 : Ajouter `banned` et `getUserBans` dans `features/users/dal.ts`**

Imports : ajouter `userBans` à l'import `@/db/schema`. `AdminUserDetail` :

```ts
export type AdminUserDetail = {
  id: string
  name: string
  username: string | null
  email: string
  image: string | null
  bio: string | null
  role: "user" | "admin"
  banned: boolean
  /** Epoch ms. */
  createdAt: number
}
```

Dans `getUserForAdmin`, ajouter `banned: user.banned,` au `select` (après `role`).

`AdminUserRow` : ajouter `banned: boolean` après `role`. Dans `getUsersWithFilters`, ajouter `banned: user.banned,` au `select` de la page et `banned: r.banned,` au mapping `items`.

Après `getUserPanelData`, ajouter :

```ts
// ============================================
// [Admin] Journal des suspensions
// ============================================

export type UserBanView = {
  id: string
  reason: string
  /** Epoch ms. */
  bannedAt: number
  /** Nul quand le compte de l'admin auteur a été supprimé (FK set null). */
  bannedByName: string | null
  /** Epoch ms ; nul = épisode ouvert (au plus un par compte). */
  liftedAt: number | null
  liftedByName: string | null
  liftReason: string | null
}

/**
 * [Admin] Épisodes de suspension d'un compte, du plus récent au plus ancien,
 * noms des admins joints (deux alias sur `user`). Borné à 20. Garde admin.
 */
export const getUserBans = async (userId: string): Promise<UserBanView[]> => {
  await requireRole(["admin"])

  const bannedBy = alias(user, "banned_by_user")
  const liftedBy = alias(user, "lifted_by_user")

  const rows = await db
    .select({
      id: userBans.id,
      reason: userBans.reason,
      bannedAt: userBans.bannedAt,
      bannedByName: bannedBy.name,
      liftedAt: userBans.liftedAt,
      liftedByName: liftedBy.name,
      liftReason: userBans.liftReason,
    })
    .from(userBans)
    .leftJoin(bannedBy, eq(bannedBy.id, userBans.bannedBy))
    .leftJoin(liftedBy, eq(liftedBy.id, userBans.liftedBy))
    .where(eq(userBans.userId, userId))
    .orderBy(desc(userBans.bannedAt), desc(userBans.id))
    .limit(20)

  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    bannedAt: r.bannedAt.getTime(),
    bannedByName: r.bannedByName,
    liftedAt: r.liftedAt ? r.liftedAt.getTime() : null,
    liftedByName: r.liftedByName,
    liftReason: r.liftReason,
  }))
}
```

- [ ] **Step 6 : Lancer les tests d'intégration users**

Run: `bun run test:integration -- tests/integration/users-ban.test.ts tests/integration/users-role.test.ts tests/integration/users-account.test.ts tests/integration/users-admin-dal.test.ts`
Expected: tous verts (`users-role` prouve que le refactor du verrou est neutre hors du nouveau refus).

- [ ] **Step 7 : `bun run check` puis commit**

Run: `bun run check`
Expected: prettier, tsc, eslint OK. Si prettier se plaint, `bun run format` puis relancer.

```bash
git add features/users tests/integration/users-ban.test.ts tests/integration/users-role.test.ts tests/integration/users-account.test.ts
git commit -m "feat(users): suspension et levée d'un compte par un admin, journalisées"
```

---

### Task 3 : Un banni n'a plus de session

**Files:**
- Modify: `lib/dal.ts`
- Modify: `.claude/rules/data-layer.md` (section « PII / frontière serveur-client », fin)
- Create: `tests/lib/dal.test.ts`

- [ ] **Step 1 : Test unitaire (échoue)**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getCurrentSession } from "@/lib/dal"

const getSession = vi.fn()
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } },
}))
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>()
  return { ...actual, cache: (fn: unknown) => fn }
})

const session = (banned: boolean | null | undefined) => ({
  session: { id: "s1", token: "t" },
  user: { id: "u1", email: "u@test.invalid", role: "user", banned },
})

beforeEach(() => getSession.mockReset())

describe("getCurrentSession", () => {
  it("renvoie la session d'un compte non banni", async () => {
    getSession.mockResolvedValue(session(false))
    expect((await getCurrentSession())?.user.id).toBe("u1")
  })

  it("tolère `banned` absent ou nul (comptes historiques)", async () => {
    getSession.mockResolvedValue(session(null))
    expect(await getCurrentSession()).not.toBeNull()
    getSession.mockResolvedValue(session(undefined))
    expect(await getCurrentSession()).not.toBeNull()
  })

  it("renvoie null pour un compte banni : une session résiduelle vaut déconnexion", async () => {
    getSession.mockResolvedValue(session(true))
    expect(await getCurrentSession()).toBeNull()
  })

  it("renvoie null sans session", async () => {
    getSession.mockResolvedValue(null)
    expect(await getCurrentSession()).toBeNull()
  })
})
```

Run: `bun run test -- tests/lib/dal.test.ts`
Expected: le test « compte banni » échoue (la session est renvoyée).

- [ ] **Step 2 : Implémenter**

`lib/dal.ts` :

```ts
import { headers } from "next/headers"
import { cache } from "react"
import "server-only"
import { auth } from "@/lib/auth"

// Dédupliqué par render via React cache(). Un compte suspendu (`user.banned`,
// relu en base à chaque requête : pas de cookieCache) est traité comme
// déconnecté par TOUS les consommateurs — la suspension supprime les sessions,
// ceci couvre la requête en vol au moment du ban.
export const getCurrentSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.banned) return null
  return session
})
```

Run: `bun run test -- tests/lib/dal.test.ts`
Expected: 4 tests verts. `session.user.banned` est typé `boolean | null | undefined` par le schéma du plugin admin (`plugins/admin/schema.d.mts`, fusionné dans `$Infer`). Si `tsc` proteste, ne PAS caster : chercher la cause (version, plugin absent de la config).

- [ ] **Step 3 : Documenter la doctrine**

À la fin de la section « PII / frontière serveur-client » de `.claude/rules/data-layer.md` :

```md
- **Suspension (`user.banned`) = pas de session.** `getCurrentSession`
  renvoie `null` pour un compte suspendu ; aucune garde ni DAL ne doit tester
  `banned` par ailleurs. Le plugin admin refuse la CRÉATION de session d'un
  banni mais ne revérifie jamais une session existante : `banUser` supprime
  donc les sessions, et ce `null` couvre la requête en vol. Le journal vit dans
  `user_bans` ; le drapeau reste le verrou lu par le plugin.
```

- [ ] **Step 4 : Vérifier et committer**

Run: `bun run check && bun run test -- tests/lib/dal.test.ts tests/features/users-dal.test.ts`
Expected: OK.

```bash
git add lib/dal.ts tests/lib/dal.test.ts .claude/rules/data-layer.md
git commit -m "feat(auth): un compte suspendu est traité comme déconnecté"
```

---

### Task 4 : Les crons de courriels ignorent les bannis

**Files:**
- Modify: `features/notifications/cron.ts` (deux `where`)
- Modify: `tests/integration/notifications-cron.test.ts` (nouveau `describe` en fin de fichier)

- [ ] **Step 1 : Test (échoue)**

À la fin de `tests/integration/notifications-cron.test.ts`, ajouter un bloc autonome (ses propres fixtures et nettoyage) :

```ts
describe("comptes suspendus", () => {
  const banned = createId()
  const bannedProduct = createId()
  let bannedTxId: string

  beforeAll(async () => {
    await db.insert(user).values({
      id: banned,
      name: "Suspendu",
      email: `ban-${banned}@test.invalid`,
      banned: true,
      banReason: "test",
    })
    await db.insert(examParticipations).values({
      id: createId(),
      examId: closedExam,
      userId: banned,
      score: 70,
      status: "completed",
      completedAt: past,
    })
    await db.insert(products).values({
      id: bannedProduct,
      code: "exam_access",
      name: "Exam court",
      description: "d",
      priceCad: 100,
      durationDays: 3,
      accessType: "exam",
      stripeProductId: `prod_ban_${banned}`,
      stripePriceId: `price_ban_${banned}`,
      stripePriceLookupKey: `price_ban_${banned}`,
    })
    bannedTxId = await db.transaction((tx) =>
      grantManualAccess(tx, {
        userId: banned,
        product: {
          id: bannedProduct,
          accessType: "exam",
          durationDays: 3,
          isCombo: false,
        },
        amountPaid: 100,
        currency: "CAD",
        paymentMethod: "interac",
        recordedBy: banned,
      }),
    )
  })

  afterAll(async () => {
    await db.delete(userAccess).where(eq(userAccess.userId, banned))
    await db.delete(transactions).where(eq(transactions.id, bannedTxId))
    await db.delete(products).where(eq(products.id, bannedProduct))
    await db
      .delete(examParticipations)
      .where(eq(examParticipations.userId, banned))
    await db.delete(user).where(eq(user.id, banned))
  })

  it("aucun courriel, aucun marqueur posé : le rappel repart si la suspension est levée", async () => {
    examResults.mockClear()
    accessExpiring.mockClear()

    await sendExamResultsNotifications()
    await sendAccessExpiryReminders()

    expect(examResults).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: `ban-${banned}@test.invalid` }),
    )
    expect(accessExpiring).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: `ban-${banned}@test.invalid` }),
    )
    const [p] = await db
      .select({ notified: examParticipations.resultsNotifiedAt })
      .from(examParticipations)
      .where(eq(examParticipations.userId, banned))
    expect(p?.notified).toBeNull()
    const [a] = await db
      .select({ reminded: userAccess.expiryReminderSentAt })
      .from(userAccess)
      .where(eq(userAccess.userId, banned))
    expect(a?.reminded).toBeNull()
  })
})
```

Run: `bun run test:integration -- tests/integration/notifications-cron.test.ts`
Expected: le nouveau test échoue (courriels envoyés, marqueurs posés).

- [ ] **Step 2 : Implémenter**

Dans `features/notifications/cron.ts`, dans les deux `where(and(...))` (résultats d'examen, rappel de fin d'accès), ajouter après `isNull(user.deletedAt)` :

```ts
        eq(user.banned, false),
```

(`eq` est déjà importé.) Ajouter au commentaire de tête de chaque fonction : « Comptes supprimés et suspendus exclus, marqueur non posé. »

Puis, dans `.claude/rules/data-layer.md`, juste après la puce « Suspension (`user.banned`) = pas de session » ajoutée en Task 3 :

```md
- **Tout expéditeur de courriel qui sélectionne ses destinataires filtre
  `banned = false`**, au même endroit que `isNull(user.deletedAt)`, sans poser
  de marqueur (le courriel doit repartir si la suspension est levée). Ce n'est
  pas propre aux deux crons de `features/notifications/cron.ts` : un nouvel
  expéditeur (bienvenue, relance, panier abandonné…) reçoit le garde ET un cas
  de test « compte suspendu exclu ».
```

- [ ] **Step 3 : Vérifier et committer**

Run: `bun run test:integration -- tests/integration/notifications-cron.test.ts && bun run check`
Expected: vert.

```bash
git add features/notifications/cron.ts tests/integration/notifications-cron.test.ts .claude/rules/data-layer.md
git commit -m "feat(notifications): aucun courriel aux comptes suspendus"
```

Vigilance de merge (à reporter dans la PR) : `feat/socle-courriels` ajoute un
courriel de bienvenue, une relance d'inactivité et un rappel de panier abandonné
(`features/notifications/{cron,welcome}.ts`). À la fusion, chacun reçoit le
garde `banned = false` et son cas de test, selon la règle ci-dessus.

---

### Task 5 : Erreur `BANNED_USER` côté formulaire courriel

**Files:**
- Modify: `lib/auth-errors.ts`
- Modify: `lib/auth.ts:133`
- Modify: `app/(auth)/connexion/_components/sign-in-form.tsx`
- Modify: `tests/lib/auth-errors.test.ts`, `tests/components/auth/sign-in-form.test.tsx`

- [ ] **Step 1 : Tests (échouent)**

`tests/lib/auth-errors.test.ts`, ajouter :

```ts
  it("classe BANNED_USER en suspension", () => {
    const r = mapAuthError({ code: "BANNED_USER", status: 403 })
    expect(r.kind).toBe("banned")
    expect(r.message).toBe("Ce compte est suspendu.")
  })
```

`tests/components/auth/sign-in-form.test.tsx` : ajouter `const replace = vi.fn()` sous `const push = vi.fn()`, remplacer le mock de navigation par `vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }))`, puis ajouter :

```ts
  it("redirige vers /compte-suspendu sur BANNED_USER, sans alerte", async () => {
    signInEmail.mockResolvedValue({
      error: { code: "BANNED_USER", status: 403 },
    })
    render(<SignInForm />)
    await fillAndSubmit()
    expect(replace).toHaveBeenCalledWith("/compte-suspendu")
    expect(screen.queryByTestId("auth-error-alert")).toBeNull()
  })

  it("passe une errorCallbackURL à la connexion Google", async () => {
    signInSocial.mockResolvedValue({ error: null })
    render(<SignInForm />)
    await userEvent.setup().click(screen.getByTestId("auth-google"))
    expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/tableau-de-bord",
      errorCallbackURL: "/connexion",
    })
  })
```

Run: `bun run test -- tests/lib/auth-errors.test.ts tests/components/auth/sign-in-form.test.tsx`
Expected: 3 échecs (kind `generic`, `replace` non appelé, `errorCallbackURL` absent).

- [ ] **Step 2 : Implémenter**

`lib/auth-errors.ts` :

```ts
export type AuthErrorKind =
  "invalid_credentials" | "email_not_verified" | "banned" | "generic"
```

et, avant le bloc `INVALID_EMAIL_OR_PASSWORD` :

```ts
  if (code === "BANNED_USER") {
    return { kind: "banned", message: "Ce compte est suspendu." }
  }
```

`sign-in-form.tsx`, dans `onSubmit` après le cas `email_not_verified` :

```ts
      if (mapped.kind === "banned") {
        // Page dédiée, sans entrée d'historique : rien à réessayer ici.
        router.replace("/compte-suspendu")
        return
      }
```

et dans `handleGoogle` :

```ts
    const { error: googleError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/tableau-de-bord",
      // Sans elle, une erreur du callback OAuth (compte suspendu…) atterrit
      // sur la page d'erreur brute de Better Auth.
      errorCallbackURL: "/connexion",
    })
```

`lib/auth.ts` :

```ts
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      bannedUserMessage: "Ce compte est suspendu.",
    }),
```

- [ ] **Step 3 : Vérifier et committer**

Run: `bun run test -- tests/lib/auth-errors.test.ts tests/components/auth/sign-in-form.test.tsx && bun run check`

```bash
git add lib/auth-errors.ts lib/auth.ts "app/(auth)/connexion/_components/sign-in-form.tsx" tests/lib/auth-errors.test.ts tests/components/auth/sign-in-form.test.tsx
git commit -m "feat(auth): connexion courriel refusée pour un compte suspendu"
```

---

### Task 6 : Retour d'erreur Google sur `/connexion`

**Files:**
- Create: `app/(auth)/connexion/_components/oauth-error-handler.tsx`
- Modify: `app/(auth)/connexion/page.tsx`
- Modify: `app/(auth)/inscription/_components/sign-up-form.tsx:54-57`
- Create: `tests/components/auth/oauth-error-handler.test.tsx`
  (`tests/components/auth/sign-up-form.test.tsx` mocke `signIn.social` sans en vérifier les arguments : rien à y changer)

- [ ] **Step 1 : Test (échoue)**

```tsx
import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { OAuthErrorHandler } from "@/app/(auth)/connexion/_components/oauth-error-handler"

const replace = vi.fn()
const toastError = vi.fn()
let params = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => params,
}))
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }))

beforeEach(() => {
  replace.mockReset()
  toastError.mockReset()
})

describe("OAuthErrorHandler", () => {
  it("ne fait rien sans paramètre error", () => {
    params = new URLSearchParams()
    render(<OAuthErrorHandler />)
    expect(replace).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("BANNED_USER → /compte-suspendu", () => {
    params = new URLSearchParams("error=BANNED_USER")
    render(<OAuthErrorHandler />)
    expect(replace).toHaveBeenCalledWith("/compte-suspendu")
    expect(toastError).not.toHaveBeenCalled()
  })

  it("autre erreur → toast générique et URL nettoyée", () => {
    params = new URLSearchParams("error=unable_to_create_user")
    render(<OAuthErrorHandler />)
    expect(toastError).toHaveBeenCalledWith(
      "La connexion avec Google a échoué. Réessayez.",
    )
    expect(replace).toHaveBeenCalledWith("/connexion")
  })
})
```

Run: `bun run test -- tests/components/auth/oauth-error-handler.test.tsx`
Expected: échec à l'import.

- [ ] **Step 2 : Implémenter le composant**

`app/(auth)/connexion/_components/oauth-error-handler.tsx` :

```tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"

// Better Auth redirige les erreurs du callback OAuth vers l'`errorCallbackURL`
// avec `?error=<code>`. Monté dans un <Suspense> : useSearchParams ferait
// sinon basculer la page statique en rendu dynamique.
export const OAuthErrorHandler = () => {
  const router = useRouter()
  const error = useSearchParams().get("error")

  useEffect(() => {
    if (!error) return
    if (error === "BANNED_USER") {
      router.replace("/compte-suspendu")
      return
    }
    toast.error("La connexion avec Google a échoué. Réessayez.")
    router.replace("/connexion")
  }, [error, router])

  return null
}
```

- [ ] **Step 3 : Monter dans la page et propager à l'inscription**

`app/(auth)/connexion/page.tsx` : ajouter `import { Suspense } from "react"` et `import { OAuthErrorHandler } from "./_components/oauth-error-handler"`, puis juste au-dessus de `<SignInForm />` :

```tsx
              <Suspense fallback={null}>
                <OAuthErrorHandler />
              </Suspense>
              <SignInForm />
```

`sign-up-form.tsx`, appel Google :

```ts
    const { error: googleError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/tableau-de-bord",
      errorCallbackURL: "/connexion",
    })
```

- [ ] **Step 4 : Vérifier et committer**

Run: `bun run test -- tests/components/auth && bun run check`
Expected: vert.

```bash
git add "app/(auth)/connexion" "app/(auth)/inscription/_components/sign-up-form.tsx" tests/components/auth
git commit -m "feat(auth): retour d'erreur Google sur la page de connexion"
```

---

### Task 7 : Page `/compte-suspendu`

**Files:**
- Create: `app/(auth)/compte-suspendu/page.tsx`
- Create: `tests/components/auth/suspended-page.test.tsx`

- [ ] **Step 1 : Test (échoue)**

```tsx
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import SuspendedPage, { metadata } from "@/app/(auth)/compte-suspendu/page"

vi.mock("@/lib/env/server", () => ({
  env: { SUPPORT_EMAIL: "support@test.invalid" },
}))
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe("page /compte-suspendu", () => {
  it("explique, donne l'adresse de contact et ne montre aucun motif", () => {
    render(<SuspendedPage />)
    expect(screen.getByRole("heading", { name: "Compte suspendu" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "support@test.invalid" })).toHaveAttribute(
      "href",
      "mailto:support@test.invalid",
    )
    expect(screen.getByRole("link", { name: /Retour à l'accueil/ })).toHaveAttribute("href", "/")
    expect(screen.queryByText(/motif/i)).toBeNull()
  })

  it("n'est pas indexée", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})
```

Run: `bun run test -- tests/components/auth/suspended-page.test.tsx`
Expected: échec à l'import.

- [ ] **Step 2 : Implémenter**

```tsx
import { ShieldOff } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { env } from "@/lib/env/server"

export const metadata: Metadata = {
  title: "Compte suspendu",
  robots: { index: false, follow: false },
}

// Même adresse que le pied de page quand SUPPORT_EMAIL n'est pas configurée.
const FALLBACK_SUPPORT_EMAIL = "nomaqbanq@outlook.com"

// Page publique, sans session : un compte suspendu n'en a plus. Elle ne sait
// pas qui la regarde et n'affiche jamais le motif (interne à l'équipe).
export default function SuspendedPage() {
  const supportEmail = env.SUPPORT_EMAIL ?? FALLBACK_SUPPORT_EMAIL

  return (
    <div className="theme-bg">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl border border-white/20 p-8 text-center shadow-2xl dark:border-gray-700/50">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-red-500 to-rose-600 shadow-lg">
            <ShieldOff className="h-8 w-8 text-white" aria-hidden="true" />
          </div>
          <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
            Compte suspendu
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            L&apos;accès à ce compte a été suspendu par l&apos;équipe NOMAQbanq.
            Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, écrivez-nous
            à{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="font-medium text-blue-600 underline dark:text-blue-400"
            >
              {supportEmail}
            </a>
            .
          </p>
          <Button asChild variant="outline" className="mt-8 rounded-xl">
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier et committer**

Run: `bun run test -- tests/components/auth/suspended-page.test.tsx && bun run check`

```bash
git add "app/(auth)/compte-suspendu" tests/components/auth/suspended-page.test.tsx
git commit -m "feat(auth): page publique de compte suspendu"
```

---

### Task 8 : `refundStripeTransaction` et `refundedAt` manuel

**Files:**
- Modify: `features/payments/stripe.ts`
- Modify: `features/payments/actions.ts:229-244` (`updateManualTransaction`)
- Create: `tests/integration/payments-refund.test.ts`

- [ ] **Step 1 : Test (échoue)**

```ts
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { products, transactions, user, userAccess } from "@/db/schema"
import { updateManualTransaction } from "@/features/payments/actions"
import { recomputeAccess } from "@/features/payments/lib"
import { refundStripeTransaction } from "@/features/payments/stripe"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"

vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({}) }))

const DAY = 24 * 60 * 60 * 1000
const suffix = createId().slice(0, 8)
const productId = createId()
const adminId = createId()
const users = { full: createId(), covered: createId(), pending: createId(), manual: createId() }
const tx = {
  full: createId(),
  coveredShort: createId(),
  coveredLong: createId(),
  pending: createId(),
  manual: createId(),
}
const pi = (k: keyof typeof tx) => `pi_refund_${k}_${suffix}`

const seed = (o: {
  id: string
  userId: string
  status: "pending" | "completed"
  days: number
  paymentIntent: string | null
  type?: "stripe" | "manual"
}) =>
  db.insert(transactions).values({
    id: o.id,
    userId: o.userId,
    productId,
    type: o.type ?? "stripe",
    status: o.status,
    amountPaid: 5000,
    currency: "CAD",
    stripeSessionId: o.paymentIntent ? `cs_${o.id}` : null,
    stripePaymentIntentId: o.paymentIntent,
    paymentMethod: o.type === "manual" ? "interac" : null,
    accessType: "exam",
    durationDays: o.days,
    accessExpiresAt: new Date(Date.now() + o.days * DAY),
    completedAt: o.status === "completed" ? new Date() : null,
  })

const examAccess = (userId: string) =>
  db
    .select({ expiresAt: userAccess.expiresAt, last: userAccess.lastTransactionId })
    .from(userAccess)
    .where(and(eq(userAccess.userId, userId), eq(userAccess.accessType, "exam")))
    .limit(1)
    .then((r) => r[0] ?? null)

const txRow = (id: string) =>
  db
    .select({ status: transactions.status, refundedAt: transactions.refundedAt })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1)
    .then((r) => r[0])

const rebuild = (userId: string) =>
  db.transaction((t) => recomputeAccess(t, { userId }))

beforeAll(async () => {
  await db.insert(user).values([
    { id: adminId, name: "Admin", email: `refund-admin-${suffix}@test.invalid`, role: "admin" },
    ...Object.entries(users).map(([k, id]) => ({
      id,
      name: `Refund ${k}`,
      email: `refund-${k}-${suffix}@test.invalid`,
    })),
  ])
  await db.insert(products).values({
    id: productId,
    code: "exam_access",
    name: "Exam",
    description: "d",
    priceCad: 5000,
    durationDays: 30,
    accessType: "exam",
    stripeProductId: `prod_refund_${suffix}`,
    stripePriceId: `price_refund_${suffix}`,
    stripePriceLookupKey: `price_refund_${suffix}`,
  })
  await seed({ id: tx.full, userId: users.full, status: "completed", days: 30, paymentIntent: pi("full") })
  await seed({ id: tx.coveredShort, userId: users.covered, status: "completed", days: 30, paymentIntent: pi("coveredShort") })
  await seed({ id: tx.coveredLong, userId: users.covered, status: "completed", days: 60, paymentIntent: pi("coveredLong") })
  await seed({ id: tx.pending, userId: users.pending, status: "pending", days: 30, paymentIntent: pi("pending") })
  await seed({ id: tx.manual, userId: users.manual, status: "completed", days: 30, paymentIntent: null, type: "manual" })
  for (const id of Object.values(users)) await rebuild(id)
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: adminId, role: "admin" },
    session: { id: createId() },
  } as never)
})

afterAll(async () => {
  for (const id of Object.values(users)) {
    await db.delete(userAccess).where(eq(userAccess.userId, id))
  }
  await db.delete(transactions).where(eq(transactions.productId, productId))
  await db.delete(products).where(eq(products.id, productId))
  for (const id of [adminId, ...Object.values(users)]) {
    await db.delete(user).where(eq(user.id, id))
  }
})

describe("refundStripeTransaction", () => {
  const refundedAt = new Date("2026-09-05T10:00:00Z")

  it("remboursement complet : refunded + refunded_at, accès retiré", async () => {
    expect(await examAccess(users.full)).not.toBeNull()
    const r = await refundStripeTransaction({
      stripePaymentIntentId: pi("full"),
      refundedAt,
    })
    expect(r).toEqual({
      status: "refunded",
      userId: users.full,
      accessReducedOrRemoved: true,
    })
    expect(await txRow(tx.full)).toEqual({ status: "refunded", refundedAt })
    expect(await examAccess(users.full)).toBeNull()
  })

  it("rejeu : skipped, rien ne bouge", async () => {
    const r = await refundStripeTransaction({
      stripePaymentIntentId: pi("full"),
      refundedAt: new Date(),
    })
    expect(r).toEqual({ status: "skipped", currentStatus: "refunded" })
    expect(await txRow(tx.full)).toEqual({ status: "refunded", refundedAt })
  })

  it("autre transaction couvrante : accès raccourci, re-pointé", async () => {
    const before = await examAccess(users.covered)
    expect(before?.last).toBe(tx.coveredLong)
    const r = await refundStripeTransaction({
      stripePaymentIntentId: pi("coveredLong"),
      refundedAt,
    })
    expect(r).toMatchObject({ status: "refunded", accessReducedOrRemoved: true })
    const after = await examAccess(users.covered)
    expect(after?.last).toBe(tx.coveredShort)
    expect(after!.expiresAt.getTime()).toBeLessThan(before!.expiresAt.getTime())
  })

  it("transaction pending : skipped, accès intact", async () => {
    const r = await refundStripeTransaction({
      stripePaymentIntentId: pi("pending"),
      refundedAt,
    })
    expect(r).toEqual({ status: "skipped", currentStatus: "pending" })
    expect(await txRow(tx.pending)).toEqual({ status: "pending", refundedAt: null })
  })

  it("payment_intent inconnu : not_found", async () => {
    const r = await refundStripeTransaction({
      stripePaymentIntentId: `pi_inconnu_${suffix}`,
      refundedAt,
    })
    expect(r).toEqual({ status: "not_found" })
  })
})

describe("updateManualTransaction — refunded_at", () => {
  const base = {
    transactionId: tx.manual,
    amountPaid: 5000,
    currency: "CAD" as const,
    paymentMethod: "interac",
  }

  it("posée sur completed → refunded, effacée sur refunded → completed", async () => {
    expect(await updateManualTransaction({ ...base, status: "refunded" })).toEqual({ success: true })
    const refunded = await txRow(tx.manual)
    expect(refunded?.status).toBe("refunded")
    expect(refunded?.refundedAt).toBeInstanceOf(Date)
    expect(await examAccess(users.manual)).toBeNull()

    expect(await updateManualTransaction({ ...base, status: "completed" })).toEqual({ success: true })
    expect(await txRow(tx.manual)).toEqual({ status: "completed", refundedAt: null })
    expect(await examAccess(users.manual)).not.toBeNull()
  })
})
```

Run: `bun run test:integration -- tests/integration/payments-refund.test.ts`
Expected: échec à l'import de `refundStripeTransaction`.

- [ ] **Step 2 : Implémenter `refundStripeTransaction`**

Dans `features/payments/stripe.ts`, ajouter `import { recomputeAccess } from "./lib"` puis, après `recordStripeDispute` :

```ts
export type RefundStripeResult =
  | { status: "refunded"; userId: string; accessReducedOrRemoved: boolean }
  | {
      status: "skipped"
      currentStatus: (typeof transactions.status.enumValues)[number]
    }
  | { status: "not_found" }

/**
 * Retour de fonds Stripe (remboursement complet ou litige perdu) : la
 * transaction passe de `completed` à `refunded` et l'accès qu'elle portait
 * est recalculé depuis les transactions restantes (`recomputeAccess`).
 * Idempotent par construction : seul un statut `completed` est réécrit — un
 * rejeu de l'événement retombe en `skipped`. Verrou `user FOR UPDATE` AVANT
 * l'écriture sur `transactions`, même ordre que `updateManualTransaction`.
 * Un remboursement partiel ne passe jamais ici (décidé par le webhook).
 */
export async function refundStripeTransaction(params: {
  stripePaymentIntentId: string
  refundedAt: Date
}): Promise<RefundStripeResult> {
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({
        id: transactions.id,
        userId: transactions.userId,
        status: transactions.status,
      })
      .from(transactions)
      .where(eq(transactions.stripePaymentIntentId, params.stripePaymentIntentId))
      .limit(1)
    if (!found) return { status: "not_found" as const }

    await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, found.userId))
      .for("update")

    const updated = await tx
      .update(transactions)
      .set({ status: "refunded", refundedAt: params.refundedAt })
      .where(
        and(eq(transactions.id, found.id), eq(transactions.status, "completed")),
      )
      .returning({ id: transactions.id })
    if (updated.length === 0) {
      // Relu SOUS verrou : le statut peut avoir changé depuis le premier SELECT.
      const [fresh] = await tx
        .select({ status: transactions.status })
        .from(transactions)
        .where(eq(transactions.id, found.id))
        .limit(1)
      return {
        status: "skipped" as const,
        currentStatus: fresh?.status ?? found.status,
      }
    }

    const { accessReducedOrRemoved } = await recomputeAccess(tx, {
      userId: found.userId,
    })
    return { status: "refunded" as const, userId: found.userId, accessReducedOrRemoved }
  })
}
```

- [ ] **Step 3 : `refundedAt` dans `updateManualTransaction`**

Dans `features/payments/actions.ts`, remplacer le `.set({...})` de `updateManualTransaction` :

```ts
      const statusChange =
        data.status && data.status !== transaction.status ? data.status : null
      await tx
        .update(transactions)
        .set({
          amountPaid: data.amountPaid,
          currency: data.currency,
          paymentMethod: data.paymentMethod,
          notes: data.notes ?? null,
          ...(statusChange
            ? {
                status: statusChange,
                refundedAt: statusChange === "refunded" ? new Date() : null,
              }
            : {}),
        })
        .where(eq(transactions.id, data.transactionId))

      // Toute transition de statut (completed ↔ refunded) rejoue le calcul
      // d'accès : couvre la révocation ET le re-crédit (bug refunded → completed).
      if (statusChange) {
        await recomputeAccess(tx, { userId: transaction.userId })
      }
```

- [ ] **Step 4 : Vérifier et committer**

Run: `bun run test:integration -- tests/integration/payments-refund.test.ts tests/integration/payments-actions.test.ts tests/integration/payments-stripe.test.ts && bun run check`
Expected: vert.

```bash
git add features/payments/stripe.ts features/payments/actions.ts tests/integration/payments-refund.test.ts
git commit -m "feat(payments): remboursement d'une transaction Stripe avec recalcul de l'accès"
```

---

### Task 9 : Webhook — `charge.refunded` et litige perdu

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`
- Modify: `tests/features/stripe-webhook-errors.test.ts`
- Modify: `.claude/rules/payments.md`

Invariant à respecter dans toute cette tâche : **l'alerte humaine part AVANT
l'écriture en base** (commentaire existant `route.ts:177-178`, revue du
2026-09-02). Le `catch` général ne connaît que `event.type` : si Neon tombe
pendant `refundStripeTransaction`, seule une alerte émise avant porte l'id de
la charge, le montant et le `payment_intent`. Après l'écriture, seules les
anomalies alertent.

- [x] **Step 0 : Abonner l'endpoint Stripe à `charge.refunded` (utilisateur, Dashboard)**

Sans cette étape, tout le lot est mort en production : l'endpoint est en
« événements sélectionnés » (précédent : plan du 2026-09-02, étape 3 du lot
manuel), et `stripe listen` relaie tout en dev, donc rien ne le révélerait.
**Fait le 2026-09-05 sur l'endpoint live** (Développeurs → Webhooks →
`/api/stripe/webhook` → `charge.refunded` coché). Il n'existe pas d'endpoint
de test au Dashboard : en local, `stripe listen --forward-to
localhost:<port>/api/stripe/webhook` relaie tous les événements. À rappeler
dans le message de PR.

- [ ] **Step 1 : Tests (échouent)**

Dans `tests/features/stripe-webhook-errors.test.ts` : ajouter `refund: vi.fn<() => Promise<unknown>>()` dans `mocks`, `refundStripeTransaction: mocks.refund` dans le mock de `@/features/payments/stripe`, et dans `beforeEach` :

```ts
  mocks.refund.mockResolvedValue({
    status: "refunded",
    userId: "u_1",
    accessReducedOrRemoved: true,
  })
```

Puis un nouveau `describe` :

```ts
describe("webhook Stripe — retours de fonds", () => {
  const refunded = (charge: Record<string, unknown>) =>
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: "evt_refund",
      type: "charge.refunded",
      created: 1_800_000_000,
      data: { object: { id: "ch_1", ...charge } },
    })

  it("remboursement complet → alerte AVANT l'écriture, puis refundStripeTransaction à la date de l'événement, 200", async () => {
    refunded({ payment_intent: "pi_r", refunded: true, amount: 20000, amount_refunded: 20000 })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.refund).toHaveBeenCalledWith({
      stripePaymentIntentId: "pi_r",
      refundedAt: new Date(1_800_000_000 * 1000),
    })
    // Une seule alerte, émise avant l'écriture : une panne Neon ne doit pas
    // la priver de son détail.
    expect(mocks.captureServerError).toHaveBeenCalledTimes(1)
    const [, error, context] = mocks.captureServerError.mock.calls[0]!
    expect((error as Error).message).toBe("remboursement Stripe complet")
    expect(context).toEqual({
      detail: "charge ch_1 · 20000/20000 cad · payment_intent pi_r",
    })
    expect(mocks.captureServerError.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.refund.mock.invocationCallOrder[0]!,
    )
  })

  it("erreur DB pendant le remboursement → l'alerte détaillée est déjà partie, 500", async () => {
    mocks.refund.mockRejectedValueOnce(new Error("Neon down"))
    refunded({ payment_intent: "pi_r", refunded: true, amount: 1, amount_refunded: 1 })
    const res = await POST(request())
    expect(res.status).toBe(500)
    expect(mocks.captureServerError.mock.calls[0]?.[2]).toEqual({
      detail: "charge ch_1 · 1/1 cad · payment_intent pi_r",
    })
  })

  it("remboursement partiel → aucun retrait, alerte, 200", async () => {
    refunded({ payment_intent: "pi_p", refunded: false, amount: 20000, amount_refunded: 1000 })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.refund).not.toHaveBeenCalled()
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      expect.objectContaining({ message: "remboursement partiel, accès conservé" }),
      expect.objectContaining({ detail: expect.stringContaining("1000/20000") }),
    )
  })

  it("payment_intent objet → id extrait", async () => {
    refunded({ payment_intent: { id: "pi_obj" }, refunded: true, amount: 1, amount_refunded: 1 })
    await POST(request())
    expect(mocks.refund).toHaveBeenCalledWith(
      expect.objectContaining({ stripePaymentIntentId: "pi_obj" }),
    )
  })

  it("sans payment_intent → alerte, 200", async () => {
    refunded({ payment_intent: null, refunded: true, amount: 1, amount_refunded: 1 })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.refund).not.toHaveBeenCalled()
    expect(mocks.captureServerError).toHaveBeenCalled()
  })

  it("rejeu (skipped: refunded) → pas d'alerte d'issue, 200", async () => {
    mocks.refund.mockResolvedValueOnce({ status: "skipped", currentStatus: "refunded" })
    refunded({ payment_intent: "pi_r", refunded: true, amount: 1, amount_refunded: 1 })
    const res = await POST(request())
    expect(res.status).toBe(200)
    // Seule l'alerte préalable « remboursement Stripe complet ».
    expect(mocks.captureServerError).toHaveBeenCalledTimes(1)
  })

  it("transaction encore pending (skipped: pending) → alerte d'anomalie, 200", async () => {
    // Paiement différé : les fonds partent, puis la complétion arrive et
    // octroierait l'accès. Sans alerte, personne ne le saurait.
    mocks.refund.mockResolvedValueOnce({ status: "skipped", currentStatus: "pending" })
    refunded({ payment_intent: "pi_late", refunded: true, amount: 1, amount_refunded: 1 })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      expect.objectContaining({ message: "retour de fonds sur une transaction non complétée" }),
      expect.objectContaining({ detail: expect.stringContaining("statut pending") }),
    )
  })

  it("transaction introuvable → alerte, 200", async () => {
    mocks.refund.mockResolvedValueOnce({ status: "not_found" })
    refunded({ payment_intent: "pi_ghost", refunded: true, amount: 1, amount_refunded: 1 })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.captureServerError).toHaveBeenCalledWith(
      "[stripe:webhook]",
      expect.objectContaining({ message: "remboursement sans transaction correspondante" }),
      expect.anything(),
    )
  })

  const disputeClosed = (status: "won" | "lost") =>
    mocks.constructEventAsync.mockResolvedValueOnce({
      id: `evt_dispute_${status}`,
      type: "charge.dispute.closed",
      created: 1_800_000_500,
      data: {
        object: {
          id: "dp_1",
          amount: 20000,
          currency: "cad",
          reason: "fraudulent",
          status,
          payment_intent: "pi_d",
        },
      },
    })

  it("litige perdu → alerte existante inchangée, dispute enregistré, remboursement, seconde alerte d'issue", async () => {
    disputeClosed("lost")
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.recordDispute).toHaveBeenCalled()
    expect(mocks.refund).toHaveBeenCalledWith({
      stripePaymentIntentId: "pi_d",
      refundedAt: new Date(1_800_000_500 * 1000),
    })
    // L'`it.each` existant sur `charge.dispute.closed` reste vrai : la
    // première alerte est celle d'avant, sans suffixe.
    const [first, second] = mocks.captureServerError.mock.calls
    expect((first?.[1] as Error).message).toBe("litige perdu")
    expect(first?.[2]).toEqual({
      detail: "dispute dp_1 · 20000 cad · motif fraudulent · statut lost · payment_intent pi_d",
    })
    expect((second?.[1] as Error).message).toBe("litige perdu · retrait d'accès")
    expect(second?.[2]).toEqual({
      detail: "dispute dp_1 · 20000 cad · motif fraudulent · statut lost · payment_intent pi_d · accès retiré",
    })
  })

  it("litige perdu sur une transaction pending → seconde alerte « non complétée »", async () => {
    mocks.refund.mockResolvedValueOnce({ status: "skipped", currentStatus: "pending" })
    disputeClosed("lost")
    await POST(request())
    const second = mocks.captureServerError.mock.calls[1]
    expect((second?.[1] as Error).message).toBe("litige perdu · retrait d'accès")
    expect(second?.[2]).toEqual({
      detail: "dispute dp_1 · 20000 cad · motif fraudulent · statut lost · payment_intent pi_d · transaction non complétée (pending)",
    })
  })

  it("litige gagné → aucun remboursement", async () => {
    disputeClosed("won")
    await POST(request())
    expect(mocks.refund).not.toHaveBeenCalled()
  })
})
```

Run: `bun run test -- tests/features/stripe-webhook-errors.test.ts`
Expected: les nouveaux tests échouent (`charge.refunded` ignoré, `refund` jamais appelé) ; l'`it.each` `charge.dispute.closed` existant reste vert et DOIT le rester après implémentation (ne pas desserrer son `toEqual`).

- [ ] **Step 2 : Implémenter dans la route**

Import : ajouter `refundStripeTransaction` et `type RefundStripeResult` à l'import de `@/features/payments/stripe`.

Helper au scope module, avant `POST` :

```ts
// Libellé de l'issue d'un retrait d'accès, pour les alertes et les logs.
const describeRefund = (result: RefundStripeResult): string => {
  if (result.status === "refunded") {
    return result.accessReducedOrRemoved
      ? "accès retiré"
      : "accès conservé, une autre transaction couvre"
  }
  if (result.status === "skipped") {
    return result.currentStatus === "refunded"
      ? "déjà refunded"
      : `transaction non complétée (${result.currentStatus})`
  }
  return "transaction introuvable"
}

// Après un retrait d'accès : un rejeu (déjà refunded) ou un succès sont des
// logs ; un retour de fonds sur une transaction pending/failed est une anomalie
// à alerter — un paiement différé encore pending peut être complété APRÈS le
// remboursement et octroyer un accès que personne ne verrait.
const reportRefundOutcome = (refund: RefundStripeResult, detail: string) => {
  if (refund.status === "not_found") {
    captureServerError(
      "[stripe:webhook]",
      new Error("remboursement sans transaction correspondante"),
      { detail },
    )
  } else if (refund.status === "skipped" && refund.currentStatus !== "refunded") {
    captureServerError(
      "[stripe:webhook]",
      new Error("retour de fonds sur une transaction non complétée"),
      { detail: `${detail} · statut ${refund.currentStatus}` },
    )
  } else {
    console.warn(`[stripe webhook] retour de fonds · ${detail} · ${describeRefund(refund)}`)
  }
}
```

Le bloc `else if (event.type === "charge.dispute.closed") { … }` existant
(alerte « litige gagné / perdu / clos », AVANT toute écriture) reste **inchangé**.
Dans le `case` litige, après le bloc `if (disputedPaymentIntent) { … recordStripeDispute … }`
existant, ajouter :

```ts
        // Litige perdu : les fonds sont partis, le service est retiré. Idempotent
        // au rejeu (Stripe redélivre) et rejouable depuis le Dashboard pour un
        // litige perdu avant ce code. L'alerte « litige perdu » est déjà partie
        // plus haut ; celle-ci ne porte que l'issue du retrait.
        if (
          event.type === "charge.dispute.closed" &&
          dispute.status === "lost" &&
          disputedPaymentIntent
        ) {
          const refund = await refundStripeTransaction({
            stripePaymentIntentId: disputedPaymentIntent,
            refundedAt: new Date(event.created * 1000),
          })
          captureServerError(
            "[stripe:webhook]",
            new Error("litige perdu · retrait d'accès"),
            { detail: `${detail} · ${describeRefund(refund)}` },
          )
        }
```

Nouveau `case`, juste avant `case "radar.early_fraud_warning.created"` :

```ts
      // Remboursement depuis le Dashboard (ou remboursement proactif après
      // EFW) : COMPLET → la transaction passe en refunded et l'accès est
      // recalculé ; PARTIEL → geste commercial, accès conservé, alerte seule.
      // Stripe = source de vérité pour l'argent, comme pour l'octroi. L'alerte
      // part AVANT l'écriture (même règle que les litiges).
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge
        const paymentIntent =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id
        const detail = `charge ${charge.id} · ${charge.amount_refunded}/${charge.amount} ${charge.currency} · payment_intent ${paymentIntent ?? "absent"}`

        if (!paymentIntent) {
          captureServerError(
            "[stripe:webhook]",
            new Error("remboursement sans payment_intent"),
            { detail },
          )
          break
        }
        if (!charge.refunded) {
          captureServerError(
            "[stripe:webhook]",
            new Error("remboursement partiel, accès conservé"),
            { detail },
          )
          break
        }

        captureServerError(
          "[stripe:webhook]",
          new Error("remboursement Stripe complet"),
          { detail },
        )
        const refund = await refundStripeTransaction({
          stripePaymentIntentId: paymentIntent,
          refundedAt: new Date(event.created * 1000),
        })
        reportRefundOutcome(refund, detail)
        break
      }
```

- [ ] **Step 3 : Mettre à jour `.claude/rules/payments.md`**

Remplacer le premier point de « Litiges et confirmation d'achat » :

```md
- **L'accès n'est jamais révoqué PENDANT un litige**, délibérément : couper
  l'accès affaiblirait la position « service livré et utilisé ». Le webhook
  alerte Sentry AVANT d'écrire en base (une panne Neon ne doit pas priver
  l'alerte de son détail : le `catch` général ne connaît que `event.type`),
  puis persiste `stripe_dispute_id` / `dispute_status` via
  `recordStripeDispute` ; la décision de contester reste humaine. **À la
  perte** (`charge.dispute.closed`, `status: lost`) et sur tout
  **remboursement complet** (`charge.refunded`, `refunded: true`),
  `refundStripeTransaction` passe la transaction en `refunded` (avec
  `refunded_at` = `event.created`) et `recomputeAccess` retire l'accès : les
  fonds sont partis, le service suit. La règle « alerte avant écriture » tient
  aussi là : l'alerte humaine (« litige perdu », « remboursement Stripe
  complet ») précède l'écriture ; une alerte d'issue distincte ou un log suit.
  Un remboursement PARTIEL ne retire rien (geste commercial) et alerte
  seulement. Idempotent : seul un statut `completed` est réécrit, un rejeu
  retombe en `skipped` ; un retour de fonds sur une transaction encore
  `pending` (paiement différé) est alerté, car la complétion qui suivrait
  octroierait l'accès. **L'endpoint du Dashboard est en événements
  sélectionnés** : `charge.refunded` doit y être coché (endpoint live, fait le
  2026-09-05), sinon ce chemin est mort en prod alors que `stripe listen`
  relaie tout en dev.
  Pour un litige perdu avant ce code, renvoyer l'événement depuis le
  Dashboard (Développeurs → Webhooks). Fonds restitués après une perte :
  alerte seule, re-crédit humain. Suspendre le compte est un geste DISTINCT
  (`banUser`), jamais automatique.
```

- [ ] **Step 4 : Vérifier et committer**

Run: `bun run test -- tests/features/stripe-webhook-errors.test.ts && bun run check`

```bash
git add app/api/stripe/webhook/route.ts tests/features/stripe-webhook-errors.test.ts .claude/rules/payments.md
git commit -m "feat(stripe): retrait d'accès sur remboursement complet et litige perdu"
```

---

### Task 10 : Section admin « Suspension »

**Files:**
- Create: `app/(admin)/admin/utilisateurs/[id]/_components/user-ban-section.tsx`
- Modify: `app/(admin)/admin/utilisateurs/[id]/page.tsx`
- Modify: `app/(admin)/admin/utilisateurs/[id]/user-detail-client.tsx`
- Create: `tests/components/admin/UserBanSection.test.tsx`

- [ ] **Step 1 : Test (échoue)**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { UserBanSection } from "@/app/(admin)/admin/utilisateurs/[id]/_components/user-ban-section"
import type { UserBanView } from "@/features/users/dal"

const mocks = vi.hoisted(() => ({
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/features/users/actions", () => ({
  banUser: mocks.banUser,
  unbanUser: mocks.unbanUser,
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}))
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

const baseUser = {
  id: "user-1",
  name: "Marie Curie",
  email: "marie@exemple.com",
  role: "user" as const,
  banned: false,
}

const activeBan: UserBanView = {
  id: "ban-1",
  reason: "Litige perdu, fraude",
  bannedAt: new Date("2026-09-05T14:00:00Z").getTime(),
  bannedByName: "Samuel",
  liftedAt: null,
  liftedByName: null,
  liftReason: null,
}

// Auteur distinct de l'épisode actif : `getByText(/par Samuel/)` lèverait
// « multiple elements » si les deux <p> le contenaient.
const pastBan: UserBanView = {
  id: "ban-0",
  reason: "Ancien épisode",
  bannedAt: new Date("2026-08-01T10:00:00Z").getTime(),
  bannedByName: "Ancien admin",
  liftedAt: new Date("2026-08-03T10:00:00Z").getTime(),
  liftedByName: "Autre",
  liftReason: "Erreur",
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset())
  mocks.banUser.mockResolvedValue({ success: true })
  mocks.unbanUser.mockResolvedValue({ success: true })
})

describe("UserBanSection", () => {
  it("compte actif : bouton de suspension, motif obligatoire", async () => {
    render(<UserBanSection user={baseUser} bans={[]} currentUserId="viewer" />)
    fireEvent.click(screen.getByTestId("ban-open"))
    const confirm = screen.getByTestId("ban-confirm")
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByTestId("ban-reason"), { target: { value: "abc" } })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByTestId("ban-reason"), {
      target: { value: "Litige perdu, fraude" },
    })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() =>
      expect(mocks.banUser).toHaveBeenCalledWith({
        userId: "user-1",
        reason: "Litige perdu, fraude",
      }),
    )
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Compte suspendu.")
  })

  it("compte suspendu : détail de l'épisode et levée avec motif facultatif", async () => {
    render(
      <UserBanSection
        user={{ ...baseUser, banned: true }}
        bans={[activeBan, pastBan]}
        currentUserId="viewer"
      />,
    )
    expect(screen.getByTestId("ban-badge")).toHaveTextContent("Suspendu")
    expect(screen.getByText("Litige perdu, fraude")).toBeInTheDocument()
    expect(screen.getByText(/par Samuel/)).toBeInTheDocument()
    expect(screen.getByText("Ancien épisode")).toBeInTheDocument()
    expect(screen.getByText(/par Ancien admin/)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("unban-open"))
    fireEvent.click(screen.getByTestId("unban-confirm"))
    await waitFor(() =>
      expect(mocks.unbanUser).toHaveBeenCalledWith({ userId: "user-1", reason: undefined }),
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Suspension levée.")
  })

  it("sa propre fiche : note, pas de bouton", () => {
    render(<UserBanSection user={baseUser} bans={[]} currentUserId={baseUser.id} />)
    expect(screen.queryByTestId("ban-open")).toBeNull()
    expect(screen.getByTestId("ban-self-note")).toBeInTheDocument()
  })

  it("cible admin : note, pas de bouton", () => {
    render(
      <UserBanSection user={{ ...baseUser, role: "admin" }} bans={[]} currentUserId="viewer" />,
    )
    expect(screen.queryByTestId("ban-open")).toBeNull()
    expect(screen.getByTestId("ban-admin-note")).toHaveTextContent(
      "Retirez d'abord le rôle administrateur",
    )
  })

  it("erreur d'action : toast, dialog ouvert, pas de refresh", async () => {
    mocks.banUser.mockResolvedValue({ success: false, error: "Ce compte est déjà suspendu." })
    render(<UserBanSection user={baseUser} bans={[]} currentUserId="viewer" />)
    fireEvent.click(screen.getByTestId("ban-open"))
    fireEvent.change(screen.getByTestId("ban-reason"), {
      target: { value: "Motif suffisant" },
    })
    fireEvent.click(screen.getByTestId("ban-confirm"))
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Ce compte est déjà suspendu."),
    )
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })
})
```

Run: `bun run test -- tests/components/admin/UserBanSection.test.tsx`
Expected: échec à l'import.

- [ ] **Step 2 : Implémenter le composant**

```tsx
"use client"

import { ShieldCheck, ShieldOff } from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { banUser, unbanUser } from "@/features/users/actions"
import type { AdminUserDetail, UserBanView } from "@/features/users/dal"
import { formatLongDateTime } from "@/lib/format"
import { callAction } from "@/lib/safe-action"

const REASON_MIN = 5
const REASON_MAX = 500

interface UserBanSectionProps {
  user: Pick<AdminUserDetail, "id" | "name" | "email" | "role" | "banned">
  bans: UserBanView[]
  currentUserId: string
}

const BanEpisode = ({ ban }: { ban: UserBanView }) => (
  <li className="rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-700">
    <p className="text-gray-500 dark:text-gray-400">
      Du {formatLongDateTime(ban.bannedAt)} par {ban.bannedByName ?? "un compte supprimé"}
      {ban.liftedAt !== null && (
        <>
          {" "}
          au {formatLongDateTime(ban.liftedAt)} par{" "}
          {ban.liftedByName ?? "un compte supprimé"}
        </>
      )}
    </p>
    <p className="mt-1 text-gray-900 dark:text-white">{ban.reason}</p>
    {ban.liftReason && (
      <p className="mt-1 text-gray-500 italic dark:text-gray-400">
        Levée : {ban.liftReason}
      </p>
    )}
  </li>
)

export const UserBanSection = ({
  user,
  bans,
  currentUserId,
}: UserBanSectionProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [isPending, startTransition] = useTransition()

  const isSelf = user.id === currentUserId
  const isAdmin = user.role === "admin"
  const activeBan = bans.find((b) => b.liftedAt === null) ?? null
  const pastBans = bans.filter((b) => b.liftedAt !== null)
  const trimmed = reason.trim()
  const banReasonValid =
    trimmed.length >= REASON_MIN && trimmed.length <= REASON_MAX

  const handleConfirm = () => {
    startTransition(async () => {
      // callAction : un rejet fetch dans une transition remonterait à l'error
      // boundary au rendu (React 19), pas seulement en unhandled rejection.
      const result = await callAction(() =>
        user.banned
          ? unbanUser({ userId: user.id, reason: trimmed || undefined })
          : banUser({ userId: user.id, reason: trimmed }),
      )
      if (result.success) {
        toast.success(user.banned ? "Suspension levée." : "Compte suspendu.")
        setOpen(false)
        setReason("")
        router.refresh()
      } else {
        toast.error(result.error ?? "Une erreur est survenue.")
      }
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Suspension
          </h3>
        </div>
        {user.banned && (
          <Badge
            data-testid="ban-badge"
            className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
          >
            Suspendu
          </Badge>
        )}
      </div>

      {user.banned ? (
        <div className="mt-3 space-y-2 text-sm">
          {activeBan ? (
            <>
              <p className="text-gray-500 dark:text-gray-400">
                Depuis le {formatLongDateTime(activeBan.bannedAt)} par{" "}
                {activeBan.bannedByName ?? "un compte supprimé"}
              </p>
              <blockquote className="border-l-2 border-red-300 pl-3 text-gray-900 dark:border-red-800 dark:text-white">
                {activeBan.reason}
              </blockquote>
            </>
          ) : (
            <p className="text-gray-500 italic dark:text-gray-400">
              Suspension sans épisode dans le journal.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Suspendre ce compte le déconnecte partout et lui interdit toute
          connexion. Ses accès et ses transactions sont conservés et reviennent
          à la levée.
        </p>
      )}

      {isSelf ? (
        <p
          data-testid="ban-self-note"
          className="mt-4 text-sm text-gray-400 italic dark:text-gray-500"
        >
          Vous ne pouvez pas suspendre votre propre compte.
        </p>
      ) : isAdmin && !user.banned ? (
        <p
          data-testid="ban-admin-note"
          className="mt-4 text-sm text-gray-400 italic dark:text-gray-500"
        >
          Retirez d&apos;abord le rôle administrateur pour suspendre ce compte.
        </p>
      ) : (
        <>
          <Button
            data-testid={user.banned ? "unban-open" : "ban-open"}
            variant={user.banned ? "outline" : "default"}
            className={
              user.banned
                ? "mt-4 w-full rounded-xl"
                : "mt-4 w-full rounded-xl bg-red-600 text-white hover:bg-red-700"
            }
            onClick={() => setOpen(true)}
          >
            {user.banned ? (
              <ShieldCheck className="mr-2 h-4 w-4" />
            ) : (
              <ShieldOff className="mr-2 h-4 w-4" />
            )}
            {user.banned ? "Lever la suspension" : "Suspendre ce compte"}
          </Button>

          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {user.banned ? "Lever la suspension ?" : "Suspendre ce compte ?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {user.name} ({user.email}){" "}
                  {user.banned
                    ? "pourra de nouveau se connecter ; ses accès sont inchangés."
                    : "sera déconnecté partout et ne pourra plus se connecter. Le motif reste interne."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-1">
                <Textarea
                  data-testid={user.banned ? "unban-reason" : "ban-reason"}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={REASON_MAX}
                  placeholder={
                    user.banned
                      ? "Motif de la levée (facultatif)"
                      : "Motif de la suspension (obligatoire, 5 à 500 caractères)"
                  }
                  aria-label="Motif"
                  rows={3}
                />
                <p className="text-right text-xs text-gray-400">
                  {trimmed.length}/{REASON_MAX}
                </p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  data-testid={user.banned ? "unban-confirm" : "ban-confirm"}
                  disabled={isPending || (!user.banned && !banReasonValid)}
                  onClick={(e) => {
                    e.preventDefault()
                    handleConfirm()
                  }}
                  className={user.banned ? "" : "bg-red-600 text-white hover:bg-red-700"}
                >
                  {user.banned ? "Lever" : "Suspendre"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {pastBans.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Épisodes précédents
          </p>
          <ul className="space-y-2">
            {pastBans.map((ban) => (
              <BanEpisode key={ban.id} ban={ban} />
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  )
}
```

(`components/ui/textarea.tsx` transmet `{...props}`, donc `data-testid` : rien à y changer. Le repli « un compte supprimé » ne s'affiche que sur un `null`, inatteignable hors suppression physique : après anonymisation, la jointure renvoie « Utilisateur supprimé », affiché tel quel.)

- [ ] **Step 3 : Câbler la page**

`app/(admin)/admin/utilisateurs/[id]/page.tsx` : importer `getUserBans` depuis `@/features/users/dal`, l'ajouter au `Promise.all` :

```ts
  const [access, txPage, products, selectableUsers, bans] = await Promise.all([
    getAccessStatus(id),
    getAllTransactions({ userId: id, limit: 10 }),
    getAvailableProducts(),
    getSelectableUsers(),
    getUserBans(id),
  ])
```

et passer `bans={bans}` à `<UserDetailClient>`.

`user-detail-client.tsx` : prop `bans: UserBanView[]` (import type depuis `@/features/users/dal`), import `UserBanSection`, et dans la colonne de gauche :

```tsx
          <UserInfoCard user={user} />
          <UserRoleSection user={user} currentUserId={currentUserId} />
          <UserBanSection user={user} bans={bans} currentUserId={currentUserId} />
```

- [ ] **Step 4 : Vérifier et committer**

Run: `bun run test -- tests/components/admin && bun run check`

```bash
git add "app/(admin)/admin/utilisateurs/[id]" tests/components/admin/UserBanSection.test.tsx
git commit -m "feat(admin): section de suspension sur la fiche utilisateur"
```

---

### Task 11 : Badge « Suspendu » dans la liste et vérification finale

**Files:**
- Modify: `app/(admin)/admin/utilisateurs/_components/users-table.tsx:232-243`

- [ ] **Step 1 : Badge**

Import `ShieldOff` depuis `lucide-react`. Dans la cellule du rôle, après le `<Badge>` existant, envelopper les deux dans un `div` :

```tsx
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={user.role === "admin" ? "default" : "secondary"}
                    className={cn(
                      user.role === "admin"
                        ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                    )}
                  >
                    {user.role === "admin" ? "Admin" : "User"}
                  </Badge>
                  {user.banned && (
                    <Badge
                      data-testid="ban-badge"
                      className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
                    >
                      <ShieldOff className="mr-1 h-3 w-3" />
                      Suspendu
                    </Badge>
                  )}
                </div>
              </TableCell>
```

- [ ] **Step 2 : Suite complète**

Run: `bun run check && bun run test`
Expected: tout vert, couverture ≥ 80 % (`bun run test:coverage` si le seuil est incertain).

Run: `bun run test:integration`
Expected: toute la suite d'intégration verte sur la branche éphémère (migration 0017 appliquée par l'orchestrateur).

- [ ] **Step 3 : Commit**

```bash
git add "app/(admin)/admin/utilisateurs/_components/users-table.tsx"
git commit -m "feat(admin): badge de suspension dans la liste des utilisateurs"
```

- [ ] **Step 4 : Vérification navigateur (utilisateur lance le serveur)**

Demander à l'utilisateur de lancer `bun dev` dans le worktree et de donner le port, puis rejouer avec `/e2e-scenario` : (1) admin suspend un compte de test connecté dans un second contexte ; (2) ce contexte, à sa prochaine navigation, atterrit sur `/connexion` ; (3) reconnexion courriel → `/compte-suspendu` ; (4) levée → reconnexion OK, accès inchangés. Ne jamais lancer le serveur soi-même.

Puis le remboursement, avec `stripe listen --forward-to localhost:<port>/api/stripe/webhook` lancé par l'utilisateur : acheter un produit avec une carte de test, vérifier `user_access`, rembourser intégralement depuis le Dashboard (mode test) ; `stripe listen` doit montrer `charge.refunded → 200`, la transaction passe `refunded` avec `refunded_at`, `user_access` disparaît. Rappeler que ce test ne prouve PAS l'abonnement de l'endpoint (Task 9 Step 0) : le vérifier dans le Dashboard, test et live.

---

## Auto-revue du plan et revue adversariale

- **Couverture de la spec** : Lot 1 → Task 1 ; Lot 2 (actions, gardes admin suspendu, garde de session, crons) → Tasks 2, 3, 4 ; Lot 3 (page, formulaire, Google, message plugin) → Tasks 5, 6, 7 ; Lot 4 (abonnement Dashboard, fonction, webhook, payments.md) → Tasks 8, 9 ; Lot 5 (DAL, section, badge) → Tasks 2 (DAL), 10, 11 ; tests → chaque task ; e2e → Task 11 étape 4.
- **Cohérence des noms** : `banUser`/`unbanUser`/`getUserBans`/`UserBanView`/`refundStripeTransaction`/`RefundStripeResult`/`describeRefund`/`reportRefundOutcome`/`OAuthErrorHandler`/`UserBanSection` identiques entre implémentation, tests et câblage. `AccountActionResult` réutilisé. `data-testid` conformes à la spec.
- **Revue de design du 2026-09-05** (`docs/superpowers/reviews/2026-09-05-revue-design-bannissement.md`), 11 constats intégrés : abonnement Stripe à `charge.refunded` (Task 9 Step 0) ; alerte « litige perdu » conservée avant l'écriture + seconde alerte d'issue, ce qui laisse l'`it.each` existant intact ; alerte sur `skipped: pending` ; gardes « admin suspendu » dans `updateUserRole` et `deleteMyAccount` ; fixtures distinctes dans `UserBanSection.test` ; `DELETE` borné aux fixtures ; « Utilisateur supprimé » via anonymisation plutôt que `null` ; consommateur de `refunded_at` nommé dans la spec ; ancre `users-table.tsx:232-243` ; règle globale « tout expéditeur filtre `banned` » + vigilance de merge avec `feat/socle-courriels` ; test « limite 20 » ajouté ; contingences inutiles (cast `banned`, `Textarea`, `sign-up-form.test`) retirées.
- **Points d'attention à l'exécution** : la migration générée doit porter le numéro 0017 ; l'orchestrateur d'intégration l'applique automatiquement ; ne pas desserrer le `toEqual` de l'`it.each` `charge.dispute.closed`.
