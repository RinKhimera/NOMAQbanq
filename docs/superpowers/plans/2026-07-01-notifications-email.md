# Notifications email (Spec B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activer un système de notifications email opt-out avec deux notifications utilisateur (résultats d'examen prêts, rappel de fin d'accès) + le réglage dans le profil.

**Architecture:** Marqueurs d'idempotence en base (`resultsNotifiedAt`, `expiryReminderSentAt`) + un balayage cron (`features/notifications/cron.ts`) branché sur la route `close-expired` existante (après les clôtures). Chaque ligne est **claim-first** (`UPDATE … SET marqueur=now WHERE marqueur IS NULL RETURNING` **avant** l'envoi) → sûr contre les deux schedulers concurrents (GitHub horaire + Vercel quotidien se recouvrent à minuit UTC), même idiome que la clôture d'examens. Préférences = 2 booléens sur `user` (opt-out, ON par défaut). Le marqueur d'expiration est remis à `null` au renouvellement dans **les deux** points d'octroi d'accès (`completeStripeTransaction` Stripe **et** `grantManualAccess` manuel — il n'existe pas de choke point unique). Emails via l'infra SES + react-email existante.

**Tech Stack:** Next.js 16 · Drizzle + Neon · Better Auth · AWS SES + react-email · Vitest.

**Spec:** [docs/superpowers/specs/2026-07-01-notifications-email-design.md](../specs/2026-07-01-notifications-email-design.md)

**Contrainte git (IMPORTANT) :** branche partagée `dev-2`. **Chaque commit ne stage QUE ses fichiers** (`git add <fichiers>`), jamais `-A`/`.`. Ne pas toucher aux fichiers `docs/**pagination**` (autre session).

---

## File Structure

**Schéma (modifiés) + migration**

- `db/schema/auth.ts` — `user` : `+ notifyExamResults`, `+ notifyAccessExpiry`.
- `db/schema/exams.ts` — `examParticipations` : `+ resultsNotifiedAt`.
- `db/schema/payments.ts` — `userAccess` : `+ expiryReminderSentAt`.
- Migration Drizzle générée (dossier `drizzle/`).

**Email (créés + modifié)**

- `email/templates/exam-results-email.tsx` (créé)
- `email/templates/access-expiring-email.tsx` (créé)
- `email/index.tsx` — `+ sendExamResultsEmail`, `+ sendAccessExpiringEmail`.

**Backend (créés + modifiés)**

- `features/notifications/cron.ts` (créé) — sweep résultats + rappels + wrapper.
- `features/notifications/dal.ts` (créé) — `getNotificationPreferences`.
- `features/notifications/actions.ts` (créé) — `updateNotificationPreferences`.
- `app/api/cron/close-expired/route.ts` (modifié) — câblage du sweep.
- `features/payments/stripe.ts` (modifié) — reset `expiryReminderSentAt` au renouvellement Stripe (canal payant principal).
- `features/payments/lib.ts` (modifié) — reset `expiryReminderSentAt` au grant manuel.

**UI (créé + modifiés)**

- `app/(dashboard)/dashboard/profil/_components/profile-notifications.tsx` (créé)
- `app/(dashboard)/dashboard/profil/_components/profile-preferences.tsx` (modifié)
- `app/(dashboard)/dashboard/profil/page.tsx` + `app/(admin)/admin/profil/page.tsx` (modifiés)

**Tests (créés)**

- `tests/integration/notifications-cron.test.ts`
- `tests/integration/notifications-prefs.test.ts`
- `tests/users/profile-notifications.test.tsx`
- (+ ajout dans `tests/email/index.test.ts` si présent, sinon `tests/email/notifications.test.ts`)

---

## Task 1 : Schéma + migration

**Files:**

- Modify: `db/schema/auth.ts`, `db/schema/exams.ts`, `db/schema/payments.ts`
- Generate: migration Drizzle

- [ ] **Step 1 : `user` — 2 colonnes booléennes** (`db/schema/auth.ts`)

Dans l'objet colonnes du `user` (après `bio`), ajouter :

```ts
    notifyExamResults: boolean("notify_exam_results").default(true).notNull(),
    notifyAccessExpiry: boolean("notify_access_expiry")
      .default(true)
      .notNull(),
```

(`boolean` est déjà importé dans ce fichier.)

- [ ] **Step 2 : `examParticipations` — marqueur + index partiel** (`db/schema/exams.ts`)

Ajouter `sql` à l'import `drizzle-orm` en tête du fichier (à côté de l'import
`drizzle-orm/pg-core` existant) :

```ts
import { sql } from "drizzle-orm"
```

Dans l'objet colonnes, après `completedAt` (ligne ~88), ajouter :

```ts
    resultsNotifiedAt: timestamp("results_notified_at", { withTimezone: true }),
```

Dans le tableau d'index de `examParticipations` (fonction `(t) => [ … ]`, ~ligne 95-100),
ajouter un **index partiel** ciblé exactement sur ce que le sweep interroge. Le
prédicat inclut le filtre de statut : sans lui, l'index contiendrait TOUTES les
participations `in_progress` (jamais marquées) et grossirait avec la charge d'examens
en cours, pas seulement avec le backlog de notifications. Clé sur `examId` (utile à la
jointure `exams`) :

```ts
    index("exam_participations_results_pending_idx")
      .on(t.examId)
      .where(
        sql`${t.status} in ('completed', 'auto_submitted') and ${t.resultsNotifiedAt} is null`,
      ),
```

- [ ] **Step 3 : `userAccess` — marqueur + index partiel** (`db/schema/payments.ts`)

Ajouter `sql` à l'import `drizzle-orm` en tête du fichier :

```ts
import { sql } from "drizzle-orm"
```

Dans l'objet colonnes, après `expiresAt` (ligne ~111), ajouter :

```ts
    expiryReminderSentAt: timestamp("expiry_reminder_sent_at", {
      withTimezone: true,
    }),
```

Dans le tableau d'index de `userAccess` (fonction `(t) => [ … ]`, ~ligne 123-127),
ajouter un **index partiel** (range-scan sur `expiresAt` borné aux lignes non
encore rappelées) :

```ts
    index("user_access_expiry_reminder_pending_idx")
      .on(t.expiresAt)
      .where(sql`${t.expiryReminderSentAt} is null`),
```

- [ ] **Step 4 : Générer la migration de schéma**

Run: `bun run db:generate`
Expected: un nouveau fichier SQL sous `drizzle/` (4 `ALTER TABLE … ADD COLUMN` + 2
`CREATE INDEX … WHERE …`). Les défauts `true`/`NULL` rendent l'ajout des **colonnes**
sûr (mais voir Step 5 pour le backfill des données).

> Les tests d'intégration appliquent automatiquement les migrations sur leur branche
> Neon éphémère (`bun run test:integration` → `drizzle-kit migrate`). Appliquer sur
> le dev/prod réel via `bun run db:migrate` **quand tu le décides** (hors plan).

- [ ] **Step 5 : Migration de BACKFILL (obligatoire avant prod)** — anti-blast historique

⚠️ La requête des résultats (Task 3) ne borne que `endDate < now` **sans fenêtre
basse**. Sans backfill, le 1er run post-déploiement enverrait « résultats prêts »
pour TOUT l'historique de participations d'examens déjà clos (l'app est en prod avec
des mois de données). Le rappel d'accès n'a PAS ce problème (borné à `expiresAt` dans
les 7 j). Générer une migration custom :

Run: `bunx drizzle-kit generate --custom --name=backfill_results_notified`
Puis remplir le fichier `drizzle/00XX_backfill_results_notified.sql` :

```sql
UPDATE "exam_participations"
SET "results_notified_at" = now()
FROM "exams"
WHERE "exam_participations"."exam_id" = "exams"."id"
  AND "exams"."end_date" < now()
  AND "exam_participations"."results_notified_at" IS NULL;
```

Marque l'historique déjà clos comme notifié ; les examens qui clôturent APRÈS le
déploiement gardent `results_notified_at = NULL` → notifiés normalement à leur
clôture. **Verrouillé par un test** (`notifications-cron.test.ts` → describe
« backfill » : exécute le VRAI SQL de la migration, vérifie clos=marqué /
ouvert=épargné).

- [ ] **Step 6 : `bun run check` (types) + commit**

Run: `bunx tsc --noEmit`
Expected: exit 0.

```bash
git add db/schema/auth.ts db/schema/exams.ts db/schema/payments.ts drizzle/
git commit -m "feat(db): colonnes préférences notif + marqueurs d'envoi (Spec B)"
```

---

## Task 2 : Templates + helpers email

**Files:**

- Create: `email/templates/exam-results-email.tsx`, `email/templates/access-expiring-email.tsx`
- Modify: `email/index.tsx`
- Test: `tests/email/notifications.test.ts`

- [ ] **Step 1 : Template résultats d'examen**

```tsx
// email/templates/exam-results-email.tsx
import { Button, Link, Section, Text } from "@react-email/components"
import { EmailLayout } from "./email-layout"

export function ExamResultsEmail({
  examTitle,
  score,
  resultUrl,
}: {
  examTitle: string
  score: number
  resultUrl: string
}) {
  return (
    <EmailLayout preview={`Vos résultats pour ${examTitle} sont disponibles`}>
      <Section>
        <Text style={{ fontSize: "16px", color: "#18181b" }}>
          Vos résultats pour <strong>{examTitle}</strong> sont maintenant
          disponibles. Score : <strong>{score}%</strong>.
        </Text>
        <Button
          href={resultUrl}
          style={{
            backgroundColor: "#18181b",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "6px",
            fontSize: "14px",
            display: "inline-block",
          }}
        >
          Voir mes résultats
        </Button>
        <Text style={{ fontSize: "13px", color: "#52525b" }}>
          Ou copiez ce lien : <Link href={resultUrl}>{resultUrl}</Link>
        </Text>
      </Section>
    </EmailLayout>
  )
}
```

- [ ] **Step 2 : Template fin d'accès**

```tsx
// email/templates/access-expiring-email.tsx
import { Button, Link, Section, Text } from "@react-email/components"
import { EmailLayout } from "./email-layout"

export function AccessExpiringEmail({
  accessType,
  daysRemaining,
  renewUrl,
}: {
  accessType: "exam" | "training"
  daysRemaining: number
  renewUrl: string
}) {
  const label = accessType === "exam" ? "aux examens" : "à l'entraînement"
  return (
    <EmailLayout preview={`Votre accès ${label} expire bientôt`}>
      <Section>
        <Text style={{ fontSize: "16px", color: "#18181b" }}>
          Votre accès {label} expire dans{" "}
          <strong>{daysRemaining} jour(s)</strong>. Renouvelez-le pour continuer
          votre préparation sans interruption.
        </Text>
        <Button
          href={renewUrl}
          style={{
            backgroundColor: "#18181b",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "6px",
            fontSize: "14px",
            display: "inline-block",
          }}
        >
          Renouveler mon accès
        </Button>
        <Text style={{ fontSize: "13px", color: "#52525b" }}>
          Ou copiez ce lien : <Link href={renewUrl}>{renewUrl}</Link>
        </Text>
      </Section>
    </EmailLayout>
  )
}
```

- [ ] **Step 3 : Helpers dans `email/index.tsx`**

Ajouter les imports des 2 templates (avec les imports existants) :

```tsx
import { AccessExpiringEmail } from "./templates/access-expiring-email"
import { ExamResultsEmail } from "./templates/exam-results-email"
```

Puis, à la fin du fichier :

```tsx
export function sendExamResultsEmail({
  to,
  examTitle,
  score,
  resultUrl,
}: {
  to: string
  examTitle: string
  score: number
  resultUrl: string
}) {
  return sendEmail({
    to,
    subject: `Résultats disponibles : ${examTitle} — NOMAQbanq`,
    react: (
      <ExamResultsEmail
        examTitle={examTitle}
        score={score}
        resultUrl={resultUrl}
      />
    ),
  })
}

export function sendAccessExpiringEmail({
  to,
  accessType,
  daysRemaining,
  renewUrl,
}: {
  to: string
  accessType: "exam" | "training"
  daysRemaining: number
  renewUrl: string
}) {
  const label = accessType === "exam" ? "aux examens" : "à l'entraînement"
  return sendEmail({
    to,
    subject: `Votre accès ${label} expire bientôt — NOMAQbanq`,
    react: (
      <AccessExpiringEmail
        accessType={accessType}
        daysRemaining={daysRemaining}
        renewUrl={renewUrl}
      />
    ),
  })
}
```

- [ ] **Step 4 : Test (mock `sendEmail`)**

```ts
// tests/email/notifications.test.ts
import { describe, expect, it, vi } from "vitest"
import { sendAccessExpiringEmail, sendExamResultsEmail } from "@/email"

const sendEmail = vi.fn().mockResolvedValue("msg-id")
vi.mock("@/email/send", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
}))

describe("emails de notification", () => {
  it("sendExamResultsEmail : sujet + destinataire", async () => {
    await sendExamResultsEmail({
      to: "u@test.invalid",
      examTitle: "Examen A",
      score: 80,
      resultUrl: "https://x/resultats",
    })
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "u@test.invalid",
        subject: expect.stringContaining("Examen A"),
      }),
    )
  })

  it("sendAccessExpiringEmail : libellé selon le type", async () => {
    await sendAccessExpiringEmail({
      to: "u@test.invalid",
      accessType: "training",
      daysRemaining: 3,
      renewUrl: "https://x/abonnements",
    })
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("à l'entraînement"),
      }),
    )
  })
})
```

- [ ] **Step 5 : Lancer, check, commit**

Run: `bun run test notifications` (dossier email) — Expected: PASS. Puis `bunx tsc --noEmit`.

```bash
git add email/templates/exam-results-email.tsx email/templates/access-expiring-email.tsx email/index.tsx tests/email/notifications.test.ts
git commit -m "feat(email): templates + helpers résultats d'examen & fin d'accès"
```

---

## Task 3 : Cron de notifications

**Files:**

- Create: `features/notifications/cron.ts`
- Test: `tests/integration/notifications-cron.test.ts`

- [ ] **Step 1 : Implémenter le cron**

```ts
// features/notifications/cron.ts
import { and, eq, gt, inArray, isNull, lt } from "drizzle-orm"
import "server-only"
import { db } from "@/db"
import { examParticipations, exams, user, userAccess } from "@/db/schema"
import { sendAccessExpiringEmail, sendExamResultsEmail } from "@/email"
import { getBaseUrl } from "@/lib/base-url"

const DAY_MS = 24 * 60 * 60 * 1000
const EXAM_RESULTS_LIMIT = 500
const ACCESS_REMINDER_LIMIT = 200

export type NotificationSweepResult = {
  examResultsSent: number
  accessRemindersSent: number
}

// Notifie les participants d'examens CLOS (endDate passée) dont les résultats sont
// désormais visibles. Marqueur `resultsNotifiedAt` = envoi unique. On pose le
// marqueur pour tout éligible-par-date (envoi seulement aux opt-in) → pas de
// re-scan des lignes opt-out. Borné + résilient (par ligne).
//
// ⚠️ Concurrence : `close-expired` est frappé par DEUX schedulers (GitHub Actions
// horaire + Vercel quotidien) qui se recouvrent à minuit UTC. Deux runs lisent le
// même lot `IS NULL`. On CLAIM donc chaque ligne par un UPDATE gardé atomique
// (`SET marqueur=now WHERE marqueur IS NULL RETURNING`) AVANT l'envoi : seul le
// run qui gagne le claim envoie → jamais de double email (même idiome que la
// clôture d'examens, features/exams/cron.ts).
export async function sendExamResultsNotifications(): Promise<number> {
  const now = new Date()
  const rows = await db
    .select({
      participationId: examParticipations.id,
      examId: examParticipations.examId,
      score: examParticipations.score,
      email: user.email,
      notify: user.notifyExamResults,
      examTitle: exams.title,
    })
    .from(examParticipations)
    .innerJoin(exams, eq(exams.id, examParticipations.examId))
    .innerJoin(user, eq(user.id, examParticipations.userId))
    .where(
      and(
        lt(exams.endDate, now),
        inArray(examParticipations.status, ["completed", "auto_submitted"]),
        isNull(examParticipations.resultsNotifiedAt),
        isNull(user.deletedAt),
      ),
    )
    .limit(EXAM_RESULTS_LIMIT)

  if (rows.length === EXAM_RESULTS_LIMIT) {
    console.warn(
      `[notif] résultats — borne ${EXAM_RESULTS_LIMIT} atteinte : le reste sera traité au prochain run`,
    )
  }

  let sent = 0
  for (const r of rows) {
    try {
      // Claim atomique (anti double-envoi concurrent) : ne poursuit que si CE run
      // pose le marqueur ; un run concurrent obtient 0 ligne et saute.
      const claimed = await db
        .update(examParticipations)
        .set({ resultsNotifiedAt: now })
        .where(
          and(
            eq(examParticipations.id, r.participationId),
            isNull(examParticipations.resultsNotifiedAt),
          ),
        )
        .returning({ id: examParticipations.id })
      if (claimed.length === 0) continue // déjà pris par un autre run
      if (!r.notify) continue // opt-out : marqueur posé, pas d'envoi (spec §5)

      await sendExamResultsEmail({
        to: r.email,
        examTitle: r.examTitle,
        score: r.score,
        resultUrl: `${getBaseUrl()}/dashboard/examen-blanc/${r.examId}/resultats`,
      })
      sent++
    } catch (error) {
      // Best-effort : si l'envoi échoue, le marqueur reste posé (anti-double), pas
      // de réessai — l'accès/les résultats restent visibles en app. Perte tolérée
      // d'un email (cf. spec §5 + Notes d'implémentation).
      console.error(
        `[notif] résultats — échec (participation ${r.participationId})`,
        error,
      )
    }
  }
  return sent
}

// Rappel de fin d'accès : accès expirant dans ≤ 7 j, une seule fois. Marqueur
// `expiryReminderSentAt` (réinitialisé au renouvellement — Stripe + manuel).
// Même claim atomique que ci-dessus (anti double-envoi concurrent).
export async function sendAccessExpiryReminders(): Promise<number> {
  const now = new Date()
  const in7d = new Date(now.getTime() + 7 * DAY_MS)
  const rows = await db
    .select({
      accessId: userAccess.id,
      accessType: userAccess.accessType,
      expiresAt: userAccess.expiresAt,
      email: user.email,
      notify: user.notifyAccessExpiry,
    })
    .from(userAccess)
    .innerJoin(user, eq(user.id, userAccess.userId))
    .where(
      and(
        gt(userAccess.expiresAt, now),
        lt(userAccess.expiresAt, in7d),
        isNull(userAccess.expiryReminderSentAt),
        isNull(user.deletedAt),
      ),
    )
    .limit(ACCESS_REMINDER_LIMIT)

  if (rows.length === ACCESS_REMINDER_LIMIT) {
    console.warn(
      `[notif] accès — borne ${ACCESS_REMINDER_LIMIT} atteinte : le reste sera traité au prochain run`,
    )
  }

  let sent = 0
  for (const r of rows) {
    try {
      const claimed = await db
        .update(userAccess)
        .set({ expiryReminderSentAt: now })
        .where(
          and(
            eq(userAccess.id, r.accessId),
            isNull(userAccess.expiryReminderSentAt),
          ),
        )
        .returning({ id: userAccess.id })
      if (claimed.length === 0) continue // déjà pris par un autre run
      if (!r.notify) continue // opt-out : marqueur posé, pas d'envoi

      await sendAccessExpiringEmail({
        to: r.email,
        accessType: r.accessType,
        daysRemaining: Math.ceil(
          (r.expiresAt.getTime() - now.getTime()) / DAY_MS,
        ),
        renewUrl: `${getBaseUrl()}/dashboard/abonnements`,
      })
      sent++
    } catch (error) {
      console.error(`[notif] accès — échec (accès ${r.accessId})`, error)
    }
  }
  return sent
}

export async function sendPendingNotifications(): Promise<NotificationSweepResult> {
  const examResultsSent = await sendExamResultsNotifications()
  const accessRemindersSent = await sendAccessExpiryReminders()
  return { examResultsSent, accessRemindersSent }
}
```

> **Claim-first (anti double-envoi) — pourquoi.** Le marqueur est désormais posé
> par un `UPDATE … WHERE marqueur IS NULL RETURNING` **avant** l'envoi (au lieu de
> envoyer-puis-marquer). Deux runs concurrents lisent le même lot, mais un seul
> gagne le claim d'une ligne donnée (verrou de ligne Postgres + re-évaluation du
> `WHERE` en READ COMMITTED) → l'autre obtient 0 ligne et saute. Conséquence
> assumée : un envoi qui échoue **après** le claim n'est pas réessayé (le marqueur
> reste posé). C'est le tradeoff best-effort déjà acté par la spec §5 ; les
> résultats/l'accès restent consultables en app, donc la perte d'un email est
> tolérable. (Une variante « relâcher le marqueur sur échec » a été écartée : elle
> réintroduit un re-scan des lignes en échec persistant, au prix d'un email
> potentiellement dupliqué.)

- [ ] **Step 2 : Test d'intégration**

```ts
// tests/integration/notifications-cron.test.ts
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examParticipations,
  exams,
  products,
  transactions,
  user,
  userAccess,
} from "@/db/schema"
import {
  sendAccessExpiryReminders,
  sendExamResultsNotifications,
} from "@/features/notifications/cron"
import { createId } from "@/lib/ids"

const examResults = vi.fn().mockResolvedValue("id")
const accessExpiring = vi.fn().mockResolvedValue("id")
vi.mock("@/email", () => ({
  sendExamResultsEmail: (...a: unknown[]) => examResults(...a),
  sendAccessExpiringEmail: (...a: unknown[]) => accessExpiring(...a),
}))

const creator = createId()
const optIn = createId()
const optOut = createId()
const closedExam = createId()
const openExam = createId()
const now = Date.now()
const past = new Date(now - 86400000)
const future = new Date(now + 86400000)

beforeAll(async () => {
  await db.insert(user).values([
    { id: creator, name: "Créateur", email: `c-${creator}@test.invalid` },
    { id: optIn, name: "Opt In", email: `in-${optIn}@test.invalid` },
    {
      id: optOut,
      name: "Opt Out",
      email: `out-${optOut}@test.invalid`,
      notifyExamResults: false,
    },
  ])
  await db.insert(exams).values([
    {
      id: closedExam,
      title: "Examen Clos",
      startDate: past,
      endDate: past,
      completionTime: 3600,
      createdBy: creator,
    },
    {
      id: openExam,
      title: "Examen Ouvert",
      startDate: past,
      endDate: future,
      completionTime: 3600,
      createdBy: creator,
    },
  ])
  await db.insert(examParticipations).values([
    {
      id: createId(),
      examId: closedExam,
      userId: optIn,
      score: 80,
      status: "completed",
      completedAt: past,
    },
    {
      id: createId(),
      examId: closedExam,
      userId: optOut,
      score: 50,
      status: "auto_submitted",
      completedAt: past,
    },
    {
      id: createId(),
      examId: openExam,
      userId: optIn,
      score: 90,
      status: "completed",
      completedAt: past,
    },
  ])
})

afterAll(async () => {
  await db
    .delete(examParticipations)
    .where(eq(examParticipations.examId, closedExam))
  await db
    .delete(examParticipations)
    .where(eq(examParticipations.examId, openExam))
  await db.delete(exams).where(eq(exams.id, closedExam))
  await db.delete(exams).where(eq(exams.id, openExam))
  await db.delete(user).where(eq(user.id, creator))
  await db.delete(user).where(eq(user.id, optIn))
  await db.delete(user).where(eq(user.id, optOut))
})

describe("sendExamResultsNotifications", () => {
  it("envoie aux opt-in d'examens clos, marque tout, ignore les examens ouverts", async () => {
    const sent = await sendExamResultsNotifications()
    expect(sent).toBe(1) // seulement optIn de l'examen clos
    expect(examResults).toHaveBeenCalledTimes(1)
    expect(examResults).toHaveBeenCalledWith(
      expect.objectContaining({ to: `in-${optIn}@test.invalid`, score: 80 }),
    )

    // Marqueur posé sur les 2 participations de l'examen CLOS (opt-in + opt-out),
    // PAS sur l'examen ouvert.
    const marked = await db
      .select({ id: examParticipations.id })
      .from(examParticipations)
      .where(
        and(
          eq(examParticipations.examId, closedExam),
          // resultsNotifiedAt non nul
        ),
      )
    // Les 2 participations de l'examen clos sont marquées ; l'ouverte ne l'est pas.
    const openRow = await db
      .select({ notifiedAt: examParticipations.resultsNotifiedAt })
      .from(examParticipations)
      .where(eq(examParticipations.examId, openExam))
      .limit(1)
    expect(marked).toHaveLength(2)
    expect(openRow[0]?.notifiedAt).toBeNull()
  })

  it("2e run = no-op (marqueur déjà posé)", async () => {
    examResults.mockClear()
    const sent = await sendExamResultsNotifications()
    expect(sent).toBe(0)
    expect(examResults).not.toHaveBeenCalled()
  })
})

describe("sendAccessExpiryReminders", () => {
  it("envoie pour un accès ≤ 7 j, marque, 2e run no-op", async () => {
    const uid = createId()
    const pid = createId()
    const tid = createId()
    await db.insert(user).values({
      id: uid,
      name: "Accès",
      email: `acc-${uid}@test.invalid`,
    })
    await db.insert(products).values({
      id: pid,
      code: "exam_access",
      name: "Examens",
      description: "Accès examens",
      priceCad: 1000,
      durationDays: 180,
      accessType: "exam",
      stripeProductId: `prod_${pid}`,
      stripePriceId: `price_${pid}`,
    })
    await db.insert(transactions).values({
      id: tid,
      userId: uid,
      productId: pid,
      type: "manual",
      status: "completed",
      amountPaid: 1000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 180,
      accessExpiresAt: new Date(now + 5 * 86400000),
    })
    await db.insert(userAccess).values({
      userId: uid,
      accessType: "exam",
      expiresAt: new Date(now + 5 * 86400000), // dans 5 j → ≤ 7 j
      lastTransactionId: tid,
    })

    accessExpiring.mockClear()
    const sent = await sendAccessExpiryReminders()
    expect(sent).toBeGreaterThanOrEqual(1)
    expect(accessExpiring).toHaveBeenCalledWith(
      expect.objectContaining({
        to: `acc-${uid}@test.invalid`,
        accessType: "exam",
      }),
    )

    accessExpiring.mockClear()
    const again = await sendAccessExpiryReminders()
    // Le nôtre est déjà marqué → il ne renvoie pas (d'autres lignes du run global
    // peuvent exister, mais pas la nôtre).
    expect(accessExpiring).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: `acc-${uid}@test.invalid` }),
    )
    void again

    await db.delete(userAccess).where(eq(userAccess.userId, uid))
    await db.delete(transactions).where(eq(transactions.id, tid))
    await db.delete(products).where(eq(products.id, pid))
    await db.delete(user).where(eq(user.id, uid))
  })
})
```

- [ ] **Step 3 : Lancer, check, commit**

Run: `bun run test:integration notifications-cron` — Expected: PASS. Puis `bunx tsc --noEmit`.

```bash
git add features/notifications/cron.ts tests/integration/notifications-cron.test.ts
git commit -m "feat(notifications): cron résultats d'examen + rappel fin d'accès (idempotent, résilient)"
```

---

## Task 4 : Câbler le sweep dans la route cron

**Files:**

- Modify: `app/api/cron/close-expired/route.ts`

- [ ] **Step 1 : Import + appel après les clôtures**

Ajouter l'import (avec les autres `@/features/*/cron`) :

```ts
import { sendPendingNotifications } from "@/features/notifications/cron"
```

Remplacer le bloc `const [examParticipations, trainingSessions, anonymizedAccounts] = await Promise.all([...])` … `return Response.json({...})` par :

```ts
const [examParticipations, trainingSessions, anonymizedAccounts] =
  await Promise.all([
    closeExpiredExamParticipations(),
    closeExpiredTrainingSessions(),
    anonymizeExpiredDeletedAccounts(),
  ])

// APRÈS les clôtures (pour inclure les `auto_submitted` du même run).
const notifications = await sendPendingNotifications()

if (
  examParticipations.closedCount > 0 ||
  trainingSessions.closedCount > 0 ||
  anonymizedAccounts.anonymizedCount > 0 ||
  notifications.examResultsSent > 0 ||
  notifications.accessRemindersSent > 0
) {
  console.log(
    `[cron close-expired] examens fermés=${examParticipations.closedCount} ` +
      `sessions fermées=${trainingSessions.closedCount} ` +
      `comptes anonymisés=${anonymizedAccounts.anonymizedCount} ` +
      `notif résultats=${notifications.examResultsSent} ` +
      `notif accès=${notifications.accessRemindersSent}`,
  )
}

return Response.json({
  examParticipations,
  trainingSessions,
  anonymizedAccounts,
  notifications,
})
```

- [ ] **Step 2 : check + commit**

Run: `bunx tsc --noEmit` — Expected: exit 0.

```bash
git add "app/api/cron/close-expired/route.ts"
git commit -m "feat(cron): déclenche le sweep de notifications après les clôtures"
```

---

## Task 5 : Reset du marqueur au renouvellement (Stripe + manuel)

**Files:**

- Modify: `features/payments/stripe.ts` (renouvellement Stripe — canal payant principal)
- Modify: `features/payments/lib.ts` (grant manuel admin)
- Test: `tests/integration/notifications-cron.test.ts` (ajout d'un `describe`)

> ⚠️ **Il n'existe PAS de `grantAccess` unique.** L'octroi d'accès qui écrit
> `userAccess.expiresAt` passe par DEUX chemins distincts, chacun avec son propre
> `onConflictDoUpdate` :
>
> - **Stripe** (webhook `checkout.session.completed`) → `completeStripeTransaction`
>   (`features/payments/stripe.ts`, `set:` **~ligne 136-139**) — **le canal payant
>   principal**.
> - **Manuel** (admin) → `grantManualAccess` (`features/payments/lib.ts`, `set:`
>   **~ligne 117-120**).
>
> Les DEUX doivent remettre `expiryReminderSentAt = null`, sinon un renouvellement
> Stripe ne ré-arme jamais le rappel → rappel **muet** après le 1er cycle sur le
> canal payant (bug bloquant relevé en revue).

> **Garde `renewed` (reset conditionnel).** Le reset ne doit se poser QUE si
> l'expiration de CE type d'accès avance réellement. Pour un achat **combo**,
> `txAccessExpiresAt = now + durée` est calculé indépendamment de l'existant : si un
> type a déjà une expiration plus lointaine (`existing > now+durée`), `finalExpiry`
> ne bouge pas — remettre `expiryReminderSentAt = null` sans condition ré-armerait à
> tort un rappel déjà envoyé (doublon différé). On conditionne donc le reset à
> `renewed = !existing || finalExpiry > existing.expiresAt`. Pour le non-combo (cumul
> strictement croissant), `renewed` est toujours vrai → comportement inchangé.

- [ ] **Step 1 : Reset conditionnel dans `completeStripeTransaction`** (`features/payments/stripe.ts`, boucle `for (const accessType of types)`, ~ligne 120-140)

Remplacer :

```ts
const finalExpiry = new Date(
  Math.max(existing?.expiresAt.getTime() ?? 0, txAccessExpiresAt.getTime()),
)
await tx
  .insert(userAccess)
  .values({
    userId: pending.userId,
    accessType,
    expiresAt: finalExpiry,
    lastTransactionId: pending.id,
  })
  .onConflictDoUpdate({
    target: [userAccess.userId, userAccess.accessType],
    set: { expiresAt: finalExpiry, lastTransactionId: pending.id },
  })
```

par :

```ts
const finalExpiry = new Date(
  Math.max(existing?.expiresAt.getTime() ?? 0, txAccessExpiresAt.getTime()),
)
// Renouvellement réel de CE type = l'expiration avance (ou 1er octroi).
const renewed =
  !existing || finalExpiry.getTime() > existing.expiresAt.getTime()
await tx
  .insert(userAccess)
  .values({
    userId: pending.userId,
    accessType,
    expiresAt: finalExpiry,
    lastTransactionId: pending.id,
  })
  .onConflictDoUpdate({
    target: [userAccess.userId, userAccess.accessType],
    set: {
      expiresAt: finalExpiry,
      lastTransactionId: pending.id,
      // Re-arme le rappel de fin d'accès uniquement si l'accès est prolongé.
      ...(renewed ? { expiryReminderSentAt: null } : {}),
    },
  })
```

- [ ] **Step 2 : Reset conditionnel dans `grantManualAccess`** (`features/payments/lib.ts`, boucle `for (const accessType of types)`, ~ligne 104-121)

Remplacer :

```ts
const finalExpiry = new Date(
  Math.max(existing?.expiresAt.getTime() ?? 0, txAccessExpiresAt.getTime()),
)
await tx
  .insert(userAccess)
  .values({
    userId,
    accessType,
    expiresAt: finalExpiry,
    lastTransactionId: transactionId,
  })
  .onConflictDoUpdate({
    target: [userAccess.userId, userAccess.accessType],
    set: { expiresAt: finalExpiry, lastTransactionId: transactionId },
  })
```

par :

```ts
const finalExpiry = new Date(
  Math.max(existing?.expiresAt.getTime() ?? 0, txAccessExpiresAt.getTime()),
)
// Renouvellement réel de CE type = l'expiration avance (ou 1er octroi).
const renewed =
  !existing || finalExpiry.getTime() > existing.expiresAt.getTime()
await tx
  .insert(userAccess)
  .values({
    userId,
    accessType,
    expiresAt: finalExpiry,
    lastTransactionId: transactionId,
  })
  .onConflictDoUpdate({
    target: [userAccess.userId, userAccess.accessType],
    set: {
      expiresAt: finalExpiry,
      lastTransactionId: transactionId,
      // Re-arme le rappel de fin d'accès uniquement si l'accès est prolongé.
      ...(renewed ? { expiryReminderSentAt: null } : {}),
    },
  })
```

- [ ] **Step 3 : Test — les DEUX chemins réinitialisent le marqueur**

Ajouter dans `tests/integration/notifications-cron.test.ts`. Imports (en tête, avec
les autres) — signatures réelles vérifiées dans le code :

```ts
import { grantManualAccess } from "@/features/payments/lib"
import { completeStripeTransaction } from "@/features/payments/stripe"
```

Puis :

```ts
describe("reset du marqueur de rappel au renouvellement", () => {
  it("completeStripeTransaction (Stripe) remet expiryReminderSentAt à null", async () => {
    const uid = createId()
    const pid = createId()
    const oldTid = createId()
    const newTid = createId()
    const sessionId = `cs_test_${uid}`
    await db.insert(user).values({
      id: uid,
      name: "Renew Stripe",
      email: `renew-stripe-${uid}@test.invalid`,
    })
    await db.insert(products).values({
      id: pid,
      code: "exam_access",
      name: "Examens",
      description: "Accès examens",
      priceCad: 1000,
      durationDays: 180,
      accessType: "exam",
      stripeProductId: `prod_${pid}`,
      stripePriceId: `price_${pid}`,
    })
    // Transaction initiale + accès existant DÉJÀ notifié (marqueur posé).
    await db.insert(transactions).values({
      id: oldTid,
      userId: uid,
      productId: pid,
      type: "manual",
      status: "completed",
      amountPaid: 1000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 180,
      accessExpiresAt: new Date(now + 2 * 86400000),
    })
    await db.insert(userAccess).values({
      userId: uid,
      accessType: "exam",
      expiresAt: new Date(now + 2 * 86400000),
      lastTransactionId: oldTid,
      expiryReminderSentAt: new Date(now - 86400000),
    })
    // Nouvelle transaction Stripe PENDING (le webhook la complète = renouvellement).
    await db.insert(transactions).values({
      id: newTid,
      userId: uid,
      productId: pid,
      type: "stripe",
      status: "pending",
      amountPaid: 1000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 180,
      accessExpiresAt: new Date(now + 180 * 86400000),
      stripeSessionId: sessionId,
    })

    const res = await completeStripeTransaction({
      stripeSessionId: sessionId,
      stripePaymentIntentId: `pi_${uid}`,
      stripeEventId: `evt_${uid}`,
    })
    expect(res.status).toBe("completed")

    const [row] = await db
      .select({ marker: userAccess.expiryReminderSentAt })
      .from(userAccess)
      .where(eq(userAccess.userId, uid))
      .limit(1)
    expect(row?.marker).toBeNull()

    // FK restrict : userAccess avant transactions.
    await db.delete(userAccess).where(eq(userAccess.userId, uid))
    await db.delete(transactions).where(eq(transactions.userId, uid))
    await db.delete(products).where(eq(products.id, pid))
    await db.delete(user).where(eq(user.id, uid))
  })

  it("grantManualAccess (manuel) remet expiryReminderSentAt à null", async () => {
    const uid = createId()
    const pid = createId()
    const oldTid = createId()
    await db.insert(user).values({
      id: uid,
      name: "Renew Manual",
      email: `renew-manual-${uid}@test.invalid`,
    })
    await db.insert(products).values({
      id: pid,
      code: "exam_access",
      name: "Examens",
      description: "Accès examens",
      priceCad: 1000,
      durationDays: 180,
      accessType: "exam",
      stripeProductId: `prod_${pid}`,
      stripePriceId: `price_${pid}`,
    })
    // Transaction initiale (FK de l'accès existant) + accès DÉJÀ notifié.
    await db.insert(transactions).values({
      id: oldTid,
      userId: uid,
      productId: pid,
      type: "manual",
      status: "completed",
      amountPaid: 1000,
      currency: "CAD",
      accessType: "exam",
      durationDays: 180,
      accessExpiresAt: new Date(now + 2 * 86400000),
    })
    await db.insert(userAccess).values({
      userId: uid,
      accessType: "exam",
      expiresAt: new Date(now + 2 * 86400000),
      lastTransactionId: oldTid,
      expiryReminderSentAt: new Date(now - 86400000),
    })

    // grantManualAccess insère sa PROPRE transaction et upsert userAccess.
    await db.transaction(async (tx) => {
      await grantManualAccess(tx, {
        userId: uid,
        product: {
          id: pid,
          accessType: "exam",
          durationDays: 180,
          isCombo: false,
        },
        amountPaid: 1000,
        currency: "CAD",
        paymentMethod: "interac",
        recordedBy: uid,
      })
    })

    const [row] = await db
      .select({ marker: userAccess.expiryReminderSentAt })
      .from(userAccess)
      .where(eq(userAccess.userId, uid))
      .limit(1)
    expect(row?.marker).toBeNull()

    await db.delete(userAccess).where(eq(userAccess.userId, uid))
    await db.delete(transactions).where(eq(transactions.userId, uid))
    await db.delete(products).where(eq(products.id, pid))
    await db.delete(user).where(eq(user.id, uid))
  })

  it("combo : ne ré-arme PAS le rappel d'un type dont l'expiration n'avance pas", async () => {
    const uid = createId()
    const pid = createId()
    const examTid = createId()
    const trainingTid = createId()
    const reminded = new Date(now - 86400000) // marqueur déjà posé
    await db.insert(user).values({
      id: uid,
      name: "Combo Asym",
      email: `combo-${uid}@test.invalid`,
    })
    await db.insert(products).values({
      id: pid,
      code: "premium_access",
      name: "Combo",
      description: "Accès combo",
      priceCad: 1500,
      durationDays: 90,
      accessType: "exam",
      isCombo: true,
      stripeProductId: `prod_${pid}`,
      stripePriceId: `price_${pid}`,
    })
    await db.insert(transactions).values([
      {
        id: examTid,
        userId: uid,
        productId: pid,
        type: "manual",
        status: "completed",
        amountPaid: 1500,
        currency: "CAD",
        accessType: "exam",
        durationDays: 90,
        accessExpiresAt: new Date(now + 2 * 86400000),
      },
      {
        id: trainingTid,
        userId: uid,
        productId: pid,
        type: "manual",
        status: "completed",
        amountPaid: 1500,
        currency: "CAD",
        accessType: "training",
        durationDays: 400,
        accessExpiresAt: new Date(now + 400 * 86400000),
      },
    ])
    // exam expire bientôt (marqueur posé) ; training expire très loin (marqueur posé).
    await db.insert(userAccess).values([
      {
        userId: uid,
        accessType: "exam",
        expiresAt: new Date(now + 2 * 86400000),
        lastTransactionId: examTid,
        expiryReminderSentAt: reminded,
      },
      {
        userId: uid,
        accessType: "training",
        expiresAt: new Date(now + 400 * 86400000),
        lastTransactionId: trainingTid,
        expiryReminderSentAt: reminded,
      },
    ])

    // Achat combo 90 j : exam est prolongé (2 j → 90 j) ; training NON (400 j > 90 j).
    await db.transaction(async (tx) => {
      await grantManualAccess(tx, {
        userId: uid,
        product: {
          id: pid,
          accessType: "exam",
          durationDays: 90,
          isCombo: true,
        },
        amountPaid: 1500,
        currency: "CAD",
        paymentMethod: "interac",
        recordedBy: uid,
      })
    })

    const rows = await db
      .select({
        accessType: userAccess.accessType,
        marker: userAccess.expiryReminderSentAt,
      })
      .from(userAccess)
      .where(eq(userAccess.userId, uid))
    const exam = rows.find((r) => r.accessType === "exam")
    const training = rows.find((r) => r.accessType === "training")
    expect(exam?.marker).toBeNull() // prolongé → ré-armé
    expect(training?.marker).not.toBeNull() // inchangé → PAS ré-armé

    await db.delete(userAccess).where(eq(userAccess.userId, uid))
    await db.delete(transactions).where(eq(transactions.userId, uid))
    await db.delete(products).where(eq(products.id, pid))
    await db.delete(user).where(eq(user.id, uid))
  })
})
```

> Notes : `grantManualAccess(tx, { userId, product: { id, accessType, durationDays,
isCombo }, amountPaid, currency: "CAD" | "XAF", paymentMethod, notes?, recordedBy })`
> et `completeStripeTransaction({ stripeSessionId, stripePaymentIntentId,
stripeEventId })` (lit la transaction pending par `stripeSessionId`) — signatures
> réelles, pas de `as never`. `now` = `Date.now()` (number) défini en tête du fichier.

- [ ] **Step 4 : Lancer, check, commit**

Run: `bun run test:integration notifications-cron` — Expected: PASS. `bunx tsc --noEmit`.

```bash
git add features/payments/stripe.ts features/payments/lib.ts tests/integration/notifications-cron.test.ts
git commit -m "feat(payments): reset du rappel de fin d'accès au renouvellement (Stripe + manuel)"
```

---

## Task 6 : Préférences — DAL + action

**Files:**

- Create: `features/notifications/dal.ts`, `features/notifications/actions.ts`
- Test: `tests/integration/notifications-prefs.test.ts`

- [ ] **Step 1 : DAL**

```ts
// features/notifications/dal.ts
import { eq } from "drizzle-orm"
import { cache } from "react"
import "server-only"
import { db } from "@/db"
import { user } from "@/db/schema"
import { getCurrentSession } from "@/lib/dal"

export type NotificationPreferences = {
  examResults: boolean
  accessExpiry: boolean
}

// Préférences de notification de l'utilisateur courant (self-scoped).
export const getNotificationPreferences = cache(
  async (): Promise<NotificationPreferences | null> => {
    const session = await getCurrentSession()
    if (!session?.user) return null
    const [row] = await db
      .select({
        examResults: user.notifyExamResults,
        accessExpiry: user.notifyAccessExpiry,
      })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)
    return row ?? null
  },
)
```

- [ ] **Step 2 : Action**

```ts
// features/notifications/actions.ts
"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import * as z from "zod"
import { db } from "@/db"
import { user } from "@/db/schema"
import { requireSession } from "@/lib/auth-guards"

const schema = z.object({
  examResults: z.boolean(),
  accessExpiry: z.boolean(),
})

export type UpdateNotificationsResult = { success: boolean; error?: string }

export const updateNotificationPreferences = async (input: {
  examResults: boolean
  accessExpiry: boolean
}): Promise<UpdateNotificationsResult> => {
  const session = await requireSession()
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides",
    }
  }
  await db
    .update(user)
    .set({
      notifyExamResults: parsed.data.examResults,
      notifyAccessExpiry: parsed.data.accessExpiry,
    })
    .where(eq(user.id, session.user.id))
  revalidatePath("/dashboard/profil")
  revalidatePath("/admin/profil")
  return { success: true }
}
```

- [ ] **Step 3 : Test d'intégration**

```ts
// tests/integration/notifications-prefs.test.ts
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { user } from "@/db/schema"
import { updateNotificationPreferences } from "@/features/notifications/actions"
import { getNotificationPreferences } from "@/features/notifications/dal"
import { requireSession } from "@/lib/auth-guards"
import { getCurrentSession } from "@/lib/dal"
import { createId } from "@/lib/ids"

vi.mock("@/lib/dal", () => ({ getCurrentSession: vi.fn() }))
vi.mock("@/lib/auth-guards", () => ({ requireSession: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const uid = createId()

beforeAll(async () => {
  await db
    .insert(user)
    .values({ id: uid, name: "Prefs", email: `prefs-${uid}@test.invalid` })
  const shape = { user: { id: uid }, session: { id: createId() } }
  vi.mocked(getCurrentSession).mockResolvedValue(shape as never)
  vi.mocked(requireSession).mockResolvedValue(shape as never)
})

afterAll(async () => {
  await db.delete(user).where(eq(user.id, uid))
})

describe("préférences de notification", () => {
  it("valeurs par défaut = opt-out (les 2 activées)", async () => {
    const prefs = await getNotificationPreferences()
    expect(prefs).toEqual({ examResults: true, accessExpiry: true })
  })

  it("updateNotificationPreferences persiste les 2 booléens", async () => {
    const res = await updateNotificationPreferences({
      examResults: false,
      accessExpiry: true,
    })
    expect(res.success).toBe(true)
    const [row] = await db
      .select({
        e: user.notifyExamResults,
        a: user.notifyAccessExpiry,
      })
      .from(user)
      .where(eq(user.id, uid))
      .limit(1)
    expect(row).toEqual({ e: false, a: true })
  })
})
```

- [ ] **Step 4 : Lancer, check, commit**

Run: `bun run test:integration notifications-prefs` — Expected: PASS. `bunx tsc --noEmit`.

```bash
git add features/notifications/dal.ts features/notifications/actions.ts tests/integration/notifications-prefs.test.ts
git commit -m "feat(notifications): DAL + action de préférences (opt-out)"
```

---

## Task 7 : Composant UI `ProfileNotifications`

**Files:**

- Create: `app/(dashboard)/dashboard/profil/_components/profile-notifications.tsx`
- Test: `tests/users/profile-notifications.test.tsx`

- [ ] **Step 1 : Test qui échoue**

```tsx
// tests/users/profile-notifications.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProfileNotifications } from "@/app/(dashboard)/dashboard/profil/_components/profile-notifications"

const mocks = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock("@/features/notifications/actions", () => ({
  updateNotificationPreferences: mocks.update,
}))

beforeEach(() => {
  mocks.update.mockResolvedValue({ success: true })
})

describe("ProfileNotifications", () => {
  it("reflète l'état initial et appelle l'action au toggle", async () => {
    render(
      <ProfileNotifications
        preferences={{ examResults: true, accessExpiry: false }}
      />,
    )
    const exam = screen.getByTestId("notif-toggle-exam-results")
    const access = screen.getByTestId("notif-toggle-access-expiry")
    expect(exam).toBeChecked()
    expect(access).not.toBeChecked()

    fireEvent.click(exam) // exam → false
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        examResults: false,
        accessExpiry: false,
      }),
    )
  })

  it("rollback si l'action échoue", async () => {
    mocks.update.mockResolvedValueOnce({ success: false, error: "boom" })
    render(
      <ProfileNotifications
        preferences={{ examResults: false, accessExpiry: false }}
      />,
    )
    const exam = screen.getByTestId("notif-toggle-exam-results")
    fireEvent.click(exam)
    await waitFor(() => expect(exam).not.toBeChecked()) // revenu à false
  })
})
```

- [ ] **Step 2 : Lancer → échoue**

Run: `bun run test profile-notifications` — Expected: FAIL.

- [ ] **Step 3 : Implémenter**

```tsx
// app/(dashboard)/dashboard/profil/_components/profile-notifications.tsx
"use client"

import { IconBell } from "@tabler/icons-react"
import { useState } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { updateNotificationPreferences } from "@/features/notifications/actions"
import type { NotificationPreferences } from "@/features/notifications/dal"

export const ProfileNotifications = ({
  preferences,
}: {
  preferences: NotificationPreferences
}) => {
  const [prefs, setPrefs] = useState(preferences)
  const [busy, setBusy] = useState(false)

  const update = async (next: NotificationPreferences) => {
    const prev = prefs
    setPrefs(next) // optimistic
    setBusy(true)
    const res = await updateNotificationPreferences(next)
    setBusy(false)
    if (!res.success) {
      setPrefs(prev) // rollback
      toast.error(res.error ?? "Échec de la mise à jour")
      return
    }
    toast.success("Préférences mises à jour")
  }

  return (
    <div className="flex flex-col">
      <NotifRow
        label="Résultats d'examen"
        description="Un email quand vos résultats d'examen sont disponibles."
        checked={prefs.examResults}
        disabled={busy}
        testId="notif-toggle-exam-results"
        onCheckedChange={(v) => update({ ...prefs, examResults: v })}
      />
      <NotifRow
        label="Fin d'accès"
        description="Un rappel avant l'expiration de votre accès."
        checked={prefs.accessExpiry}
        disabled={busy}
        testId="notif-toggle-access-expiry"
        onCheckedChange={(v) => update({ ...prefs, accessExpiry: v })}
      />
    </div>
  )
}

const NotifRow = ({
  label,
  description,
  checked,
  disabled,
  testId,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled: boolean
  testId: string
  onCheckedChange: (v: boolean) => void
}) => (
  <div className="flex items-start gap-4 rounded-xl p-4">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/30">
      <IconBell className="h-5 w-5 text-rose-600 dark:text-rose-400" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="font-medium text-gray-900 dark:text-white">{label}</p>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
    <div className="shrink-0">
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        data-testid={testId}
      />
    </div>
  </div>
)
```

> Note test : le `Switch` shadcn rend un `role="switch"` avec `aria-checked` ;
> `toBeChecked()` fonctionne. Si le stub happy-dom ne l'expose pas, remplacer par
> `expect(exam.getAttribute("aria-checked")).toBe("true")`.

- [ ] **Step 4 : Lancer → passe, commit**

Run: `bun run test profile-notifications` — Expected: PASS.

```bash
git add "app/(dashboard)/dashboard/profil/_components/profile-notifications.tsx" tests/users/profile-notifications.test.tsx
git commit -m "feat(profil): composant switches de notifications"
```

---

## Task 8 : Câbler dans `ProfilePreferences` + pages

**Files:**

- Modify: `app/(dashboard)/dashboard/profil/_components/profile-preferences.tsx`
- Modify: `app/(dashboard)/dashboard/profil/page.tsx`, `app/(admin)/admin/profil/page.tsx`

- [ ] **Step 1 : `profile-preferences.tsx` — prop + remplacement du bloc désactivé**

Remplacer les imports devenus inutiles. Retirer de la ligne d'import `@tabler/icons-react`
le `IconBell` (déplacé dans `ProfileNotifications`) ; retirer les imports `Switch` et
`Tooltip*` ; ajouter l'import du composant + type :

```ts
import type { NotificationPreferences } from "@/features/notifications/dal"
import { ProfileNotifications } from "./profile-notifications"
```

Changer la signature du composant :

```ts
export const ProfilePreferences = ({
  notificationPreferences,
}: {
  notificationPreferences: NotificationPreferences
}) => {
```

Remplacer le bloc `{/* Email notifications - disabled */}` … `</PreferenceItem>`
(lignes ~209-230) par :

```tsx
{
  /* Email notifications */
}
;<ProfileNotifications preferences={notificationPreferences} />
```

> Après suppression, vérifier via `bunx eslint` qu'aucun import n'est orphelin
> (`IconBell`, `Switch`, `Tooltip*`). `Badge` reste utilisé par `PreferenceItem`.

- [ ] **Step 2 : `app/(dashboard)/dashboard/profil/page.tsx`**

Ajouter `getNotificationPreferences` à l'import DAL notifications et au `Promise.all`,
puis passer la prop (défaut si null) :

```ts
import { getNotificationPreferences } from "@/features/notifications/dal"
```

```ts
const [accessStatus, methods, sessions, notificationPreferences] =
  await Promise.all([
    getAccessStatus(),
    getLoginMethods(),
    getUserSessions(),
    getNotificationPreferences(),
  ])
```

Et le rendu :

```tsx
<ProfilePreferences
  notificationPreferences={
    notificationPreferences ?? { examResults: true, accessExpiry: true }
  }
/>
```

- [ ] **Step 3 : `app/(admin)/admin/profil/page.tsx`**

Idem : import, ajout au `Promise.all` (`const [methods, sessions, notificationPreferences] = await Promise.all([getLoginMethods(), getUserSessions(), getNotificationPreferences()])`),
et passer la prop `notificationPreferences={notificationPreferences ?? { examResults: true, accessExpiry: true }}` à `<ProfilePreferences>`.

- [ ] **Step 4 : Vérifs + commit**

Run: `bunx tsc --noEmit` puis `bun run test` (suite frontend — le test préférences existant, s'il en existe un, peut nécessiter la nouvelle prop → l'ajuster).
Expected: exit 0 + tests verts.

```bash
git add "app/(dashboard)/dashboard/profil/_components/profile-preferences.tsx" "app/(dashboard)/dashboard/profil/page.tsx" "app/(admin)/admin/profil/page.tsx"
git commit -m "feat(profil): active les notifications par email dans les préférences"
```

> ⚠️ Si un test frontend existant rend `<ProfilePreferences />` sans prop, il faut
> lui passer `notificationPreferences={{ examResults: true, accessExpiry: true }}`.
> Chercher : `grep -rn "ProfilePreferences" tests/`.

---

## Notes d'implémentation

- **Idempotence + anti double-envoi** : marqueurs posés pour tout éligible-par-date
  (envoi seulement aux opt-in) → pas de re-scan des opt-out (cf. spec §5). Chaque
  ligne est **claim-first** (`UPDATE … WHERE marqueur IS NULL RETURNING` avant
  l'envoi) → sûr contre les 2 schedulers concurrents (GitHub horaire + Vercel
  quotidien à minuit UTC). Send-failure n'est PAS réessayé (best-effort), mais loggé.
- **Reset renouvellement** : DEUX points (`completeStripeTransaction` dans
  `features/payments/stripe.ts` **et** `grantManualAccess` dans
  `features/payments/lib.ts`) — pas de choke point unique. Les deux remettent
  `expiryReminderSentAt = null` **sous garde `renewed`** (seulement si l'expiration
  de CE type d'accès avance réellement) → un achat combo ne ré-arme pas le rappel
  d'un type déjà plus lointain.
- **Index partiels** (T1) : sur les 2 marqueurs. `examParticipations` : prédicat
  `status IN ('completed','auto_submitted') AND results_notified_at IS NULL` (exclut
  les `in_progress` jamais marqués). `userAccess` : `WHERE expiry_reminder_sent_at IS
NULL` (le range-scan sur `expiresAt` borne déjà le balayage).
- **Bornes** (500/200) : troncature **loggée** (`console.warn`) quand la borne est
  atteinte — pas de silence.
- **Ordre cron** : notifications APRÈS les clôtures (inclut les `auto_submitted` du run).
- **Migration** : `db:generate` crée le fichier ; l'intégration l'applique sur la
  branche éphémère ; dev/prod via `db:migrate` à ton rythme.

### Connu / hors périmètre

- **Combo = 2 rappels simultanés** : un produit combo pose 2 lignes `userAccess`
  (exam + training) ; si elles expirent le même jour, 2 emails de rappel au même run.
  Chacun est exact (chaque type d'accès expire réellement). Regrouper en un seul
  email est une amélioration ultérieure (non retenue — YAGNI). ⚠️ À distinguer du
  **re-déclenchement différé** d'un combo asymétrique, lui **corrigé** par la garde
  `renewed` (T5).

## Self-Review (fait à l'écriture + après revue adversariale)

- **Couverture spec** : §4 schéma+index (T1) ✅ · §5 cron+reset (T3,T4,T5) ✅ ·
  emails (T2) ✅ · §6 UI (T7,T8) ✅ · préférences DAL/action (T6) ✅ · tests
  (T2,T3,T5,T6,T7) ✅.
- **Types cohérents** : `NotificationPreferences` défini en T6 (dal), réutilisé
  T7/T8 ✅ ; `sendExamResultsEmail`/`sendAccessExpiringEmail` définis T2, appelés
  T3 ✅ ; `sendPendingNotifications` défini T3, appelé T4 ✅.
- **Corrections post-revue v1** : `grantAccess` inexistant → T5 édite les 2 vrais
  chemins (`completeStripeTransaction` + `grantManualAccess`), test sur signatures
  réelles (plus de `as never`) ✅ ; double-envoi → claim-first atomique (T3) ✅ ;
  index partiels (T1) ✅ ; log de troncature (T3) ✅. Signatures `grantManualAccess`
  / `completeStripeTransaction` vérifiées à la source.
- **Corrections post-revue v2** : reset combo inconditionnel → garde `renewed` dans
  les 2 upserts + test « combo asymétrique » (T5) ✅ ; index partiel
  `examParticipations` resserré sur le statut (T1) ✅ ; renvoi croisé mort spec §4→§5
  corrigé ✅.
