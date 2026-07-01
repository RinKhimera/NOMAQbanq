# Choix d'audience à la création d'examen (Feature 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin de définir l'audience d'un examen — ouvert à tous les abonnés `exam` (actuel) ou restreint à une liste d'utilisateurs choisis (la sélection octroie l'accès, même sans abonnement) — et faire respecter ce choix sur la visibilité (liste, leaderboard) et l'accès (démarrage).

**Architecture:** Une colonne `audienceType` sur `exams` + une table de jonction `examAudience`. La sélection octroie l'accès : `startExam` autorise un membre restreint sans abonnement ; la liste et le leaderboard masquent les examens restreints aux non-membres. UI admin = radio + multi-select recherchable réutilisant le pattern `Command`/`Popover`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM + Neon, Better Auth, Tailwind v4 + shadcn/ui, Vitest.

**Spec source :** [`docs/superpowers/specs/2026-06-28-audience-examens-design.md`](../specs/2026-06-28-audience-examens-design.md)

**Branche :** `feat/refonte-quiz-audience-images`.

> **Dépendance F1 :** la re-vérification d'accès de fin de passation s'applique à `finalizeExam` (renommée en F1). Si F1 n'est pas encore implémentée, appliquer la même logique à `submitExamAnswers`. Le reste de F2 est indépendant de F1.

---

## File Structure

**Modifiés :**

- `db/schema/enums.ts` — enum `examAudienceType`.
- `db/schema/exams.ts` — colonne `exams.audienceType` + table `examAudience`.
- `features/exams/schemas.ts` — `audienceType` + `audienceUserIds` dans create/update.
- `features/exams/actions.ts` — `createExam`/`updateExam` (audience), garde `startExam`, garde `finalizeExam`.
- `features/exams/dal.ts` — filtre liste `getExamsWithParticipation`, garde `getExamLeaderboard`, `getExamAudience`.
- `features/users/dal.ts` — `searchSelectableUsers`.
- `app/(admin)/admin/exams/create/_components/exam-create-form.tsx` (+ form d'édition) — radio + picker.
- `app/(admin)/admin/exams/[id]/_components/eligible-candidates-section.tsx` — affichage selon le type.

**Créés :**

- `components/admin/user-multi-select.tsx` — picker recherchable réutilisable.
- `tests/integration/exam-audience.test.ts`.

---

## Task 1 : Schéma `audienceType` + table `examAudience`

**Files:**

- Modify: `db/schema/enums.ts`
- Modify: `db/schema/exams.ts`

- [ ] **Step 1 : Enum**

Dans `db/schema/enums.ts` :

```ts
export const examAudienceType = pgEnum("exam_audience_type", [
  "subscribers",
  "restricted",
])
```

- [ ] **Step 2 : Colonne + table**

Dans `db/schema/exams.ts`, importer `examAudienceType`, ajouter la colonne à `exams` (après `isActive`) :

```ts
audienceType: examAudienceType("audience_type").default("subscribers").notNull(),
```

Et, en fin de fichier, la table de jonction :

```ts
export const examAudience = pgTable(
  "exam_audience",
  {
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.examId, t.userId] }),
    index("exam_audience_user_id_idx").on(t.userId),
  ],
)
```

- [ ] **Step 3 : Générer + inspecter + migrer**

Run: `bun run db:generate` → vérifier `CREATE TYPE exam_audience_type`, `ALTER TABLE exams ADD COLUMN audience_type … DEFAULT 'subscribers' NOT NULL`, `CREATE TABLE exam_audience`. Puis `bun run db:migrate`.

- [ ] **Step 4 : Commit**

```bash
git add db/schema/enums.ts db/schema/exams.ts drizzle/
git commit -m "feat(db): exams.audienceType + table examAudience"
```

---

## Task 2 : DAL `searchSelectableUsers` + `getExamAudience`

**Files:**

- Modify: `features/users/dal.ts`
- Modify: `features/exams/dal.ts`
- Test: `tests/integration/exam-audience.test.ts`

- [ ] **Step 1 : Test (échec attendu)**

Créer `tests/integration/exam-audience.test.ts` (setup branche Neon comme `exams.test.ts`) :

```ts
import { describe, expect, it } from "vitest"
import { getExamAudience } from "@/features/exams/dal"
import { searchSelectableUsers } from "@/features/users/dal"

describe("searchSelectableUsers", () => {
  it("recherche par nom/email, exclut admins, borné", async () => {
    const { adminId } = await seedAdmin()
    await seedUser({ name: "Alice Dupont", email: "alice@ex.com" })
    await asUser(adminId, async () => {
      const rows = await searchSelectableUsers({ query: "alice", limit: 10 })
      expect(rows.some((u) => u.email === "alice@ex.com")).toBe(true)
      expect(rows.every((u) => u.id !== adminId)).toBe(true)
    })
  })
})
```

- [ ] **Step 2 : Lancer (échec)** — Run: `bun run test:integration -- exam-audience` → FAIL.

- [ ] **Step 3 : Implémenter `searchSelectableUsers`**

Dans `features/users/dal.ts` (réutilise `escapeLike`, `SelectableUser`) :

```ts
export const searchSelectableUsers = async ({
  query,
  limit = 20,
}: {
  query?: string
  limit?: number
}): Promise<SelectableUser[]> => {
  await requireRole(["admin"])
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 50)
  const term = query?.trim()
  return db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(
      and(
        ne(user.role, "admin"),
        isNull(user.deletedAt),
        term
          ? or(
              ilike(user.name, `%${escapeLike(term)}%`),
              ilike(user.email, `%${escapeLike(term)}%`),
            )
          : undefined,
      ),
    )
    .orderBy(asc(user.name))
    .limit(safeLimit)
}
```

- [ ] **Step 4 : Implémenter `getExamAudience`**

Dans `features/exams/dal.ts` :

```ts
export type ExamAudienceUser = { id: string; name: string; email: string }

export const getExamAudience = cache(
  async (examId: string): Promise<ExamAudienceUser[]> => {
    await requireRole(["admin"])
    return db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(examAudience)
      .innerJoin(user, eq(user.id, examAudience.userId))
      .where(eq(examAudience.examId, examId))
      .orderBy(asc(user.name))
      .limit(1000)
  },
)
```

Importer `examAudience` dans `features/exams/dal.ts`.

- [ ] **Step 5 : Wrapper action (lecture client)**

Dans `features/exams/actions.ts`, exposer `loadSearchSelectableUsers` et `loadExamAudience` (garde `requireRole(["admin"])`, délèguent à la DAL) pour les composants clients.

- [ ] **Step 6 : Lancer (succès)** — Run: `bun run test:integration -- exam-audience` → le test searchSelectableUsers PASS.

- [ ] **Step 7 : Commit**

```bash
git add features/users/dal.ts features/exams/dal.ts features/exams/actions.ts tests/integration/exam-audience.test.ts
git commit -m "feat(exams): searchSelectableUsers + getExamAudience"
```

---

## Task 3 : Schémas zod create/update (audience)

**Files:**

- Modify: `features/exams/schemas.ts`

- [ ] **Step 1 : Ajouter les champs + refine**

Dans `examFields`, ajouter :

```ts
audienceType: z.enum(["subscribers", "restricted"]).default("subscribers"),
audienceUserIds: z.array(z.string().min(1)).max(5000).default([]),
```

Ajouter un refine partagé (create + update) :

```ts
const audienceValid = (d: {
  audienceType: "subscribers" | "restricted"
  audienceUserIds: string[]
}) => d.audienceType === "subscribers" || d.audienceUserIds.length >= 1
const audienceIssue = {
  message: "Sélectionnez au moins un utilisateur",
  path: ["audienceUserIds"],
}
```

Chaîner `.refine(audienceValid, audienceIssue)` sur `createExamSchema` et `updateExamSchema`.

- [ ] **Step 2 : Compiler** — Run: `bunx tsc --noEmit` → erreurs uniquement dans `actions.ts` (corrigées en Task 4/5).

- [ ] **Step 3 : Commit** — `git add features/exams/schemas.ts && git commit -m "feat(exams): audienceType/audienceUserIds dans les schémas"`

---

## Task 4 : `createExam` persiste l'audience

**Files:**

- Modify: `features/exams/actions.ts` (`createExam`)
- Test: `tests/integration/exam-audience.test.ts`

- [ ] **Step 1 : Test (échec attendu)**

```ts
it("createExam restreint insère examAudience (dédupliqué)", async () => {
  const { adminId } = await seedAdmin()
  const u1 = await seedUser({})
  const u2 = await seedUser({})
  const qIds = await seedQuestions(2)
  await asUser(adminId, async () => {
    const res = await createExam({
      title: "Restreint",
      startDate: Date.now(),
      endDate: Date.now() + 86400000,
      questionIds: qIds,
      enablePause: false,
      audienceType: "restricted",
      audienceUserIds: [u1.id, u2.id, u1.id], // doublon volontaire
    })
    expect(res.success).toBe(true)
    if (res.success) {
      const audience = await getExamAudience(res.examId)
      expect(audience).toHaveLength(2) // dédupliqué
    }
  })
})
```

- [ ] **Step 2 : Lancer (échec)** — Run: `bun run test:integration -- exam-audience` → FAIL.

- [ ] **Step 3 : Implémenter** — dans `createExam`, après l'`insert(exams)`, ajouter `audienceType` à l'insert, puis insérer l'audience si restreint :

```ts
await tx.insert(exams).values({ /* …existant… */ audienceType })
await tx.insert(examQuestions).values(/* …existant… */)

if (audienceType === "restricted") {
  const uniqueIds = [...new Set(audienceUserIds)]
  const valid = await tx
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, uniqueIds), isNull(user.deletedAt)))
  if (valid.length !== uniqueIds.length) throw new Error("INVALID_USERS")
  await tx
    .insert(examAudience)
    .values(uniqueIds.map((userId) => ({ examId, userId })))
}
```

Déstructurer `audienceType, audienceUserIds` de `parsed.data` ; importer `examAudience`, `user` (déjà importé), `isNull`. Ajouter le mapping d'erreur `INVALID_USERS → "Certains utilisateurs sélectionnés sont introuvables."`.

- [ ] **Step 4 : Lancer (succès)** — Run: `bun run test:integration -- exam-audience` → PASS.

- [ ] **Step 5 : Commit** — `git add features/exams/actions.ts tests/integration/exam-audience.test.ts && git commit -m "feat(exams): createExam persiste l'audience restreinte"`

---

## Task 5 : `updateExam` édite l'audience à tout moment

**Files:**

- Modify: `features/exams/actions.ts` (`updateExam`)
- Test: `tests/integration/exam-audience.test.ts`

- [ ] **Step 1 : Test (échec attendu)**

```ts
it("updateExam réécrit l'audience et la vide en bascule subscribers", async () => {
  // créer un examen restreint avec [u1], puis update → restreint [u2] → audience = [u2]
  // puis update → subscribers → audience vide. Participations non touchées.
})
```

- [ ] **Step 2 : Lancer (échec)** — FAIL.

- [ ] **Step 3 : Implémenter** — dans `updateExam`, ajouter `audienceType` au `.set({…})` de l'update `exams`, puis (toujours, indépendamment de `hasParticipations` car l'audience reste éditable) :

```ts
await tx.delete(examAudience).where(eq(examAudience.examId, id))
if (audienceType === "restricted") {
  const uniqueIds = [...new Set(audienceUserIds)]
  const valid = await tx
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, uniqueIds), isNull(user.deletedAt)))
  if (valid.length !== uniqueIds.length) throw new Error("INVALID_USERS")
  await tx
    .insert(examAudience)
    .values(uniqueIds.map((userId) => ({ examId: id, userId })))
}
```

> Note : ne JAMAIS toucher `examParticipations` ici (audience éditable, participations conservées).

- [ ] **Step 4 : Lancer (succès)** — PASS.

- [ ] **Step 5 : Commit** — `git add features/exams/actions.ts tests/integration/exam-audience.test.ts && git commit -m "feat(exams): updateExam édite l'audience"`

---

## Task 6 : Garde `startExam` (sélection = accès)

**Files:**

- Modify: `features/exams/actions.ts` (`startExam`)
- Test: `tests/integration/exam-audience.test.ts`

- [ ] **Step 1 : Tests (échec attendu)**

```ts
it("startExam restreint : membre SANS abonnement autorisé ; non-membre refusé", async () => {
  const { adminId } = await seedAdmin()
  const member = await seedUser({}) // pas d'abonnement
  const outsider = await seedUser({})
  let examId = ""
  await asUser(adminId, async () => {
    const r = await createExam({
      /* … */ audienceType: "restricted",
      audienceUserIds: [member.id],
    })
    if (r.success) examId = r.examId
  })
  await asUser(member.id, async () => {
    expect((await startExam({ examId })).success).toBe(true) // sélection octroie l'accès
  })
  await asUser(outsider.id, async () => {
    expect((await startExam({ examId })).success).toBe(false)
  })
})

it("startExam subscribers : abonné autorisé, non-abonné refusé (inchangé)", async () => {
  /* … */
})
```

- [ ] **Step 2 : Lancer (échec)** — FAIL.

- [ ] **Step 3 : Implémenter** — ajouter `audienceType` au `select` de l'exam dans la transaction `startExam`, puis remplacer le garde d'accès (retirer le `hasAccess` pré-transaction ligne ~372 et décider dans la tx) :

```ts
// dans la tx, après avoir chargé `exam` (avec audienceType) et vérifié la fenêtre :
if (!isAdmin) {
  if (exam.audienceType === "restricted") {
    const [m] = await tx
      .select({ userId: examAudience.userId })
      .from(examAudience)
      .where(
        and(eq(examAudience.examId, examId), eq(examAudience.userId, userId)),
      )
      .limit(1)
    if (!m) throw new Error("NOT_IN_AUDIENCE")
  } else if (!(await hasAccess("exam"))) {
    throw new Error("ACCESS_EXPIRED")
  }
}
```

Ajouter au mapping d'erreurs : `NOT_IN_AUDIENCE → "Cet examen ne vous est pas destiné."`, `ACCESS_EXPIRED → "Votre accès aux examens a expiré."`. Retirer l'ancien `if (!isAdmin && !(await hasAccess("exam")))` hors transaction.

- [ ] **Step 4 : Lancer (succès)** — PASS.

- [ ] **Step 5 : Commit** — `git add features/exams/actions.ts tests/integration/exam-audience.test.ts && git commit -m "feat(exams): startExam — la sélection octroie l'accès (restreint)"`

---

## Task 7 : Garde `finalizeExam` (tolérant pour le restreint)

**Files:**

- Modify: `features/exams/actions.ts` (`finalizeExam` — ou `submitExamAnswers` si F1 non livrée)

- [ ] **Step 1 : Implémenter la re-vérification asymétrique** — charger `audienceType` de l'exam, puis :

```ts
if (!isAdmin) {
  if (exam.audienceType === "subscribers") {
    const [acc] = await tx
      .select({ expiresAt: userAccess.expiresAt })
      .from(userAccess)
      .where(
        and(eq(userAccess.userId, userId), eq(userAccess.accessType, "exam")),
      )
      .limit(1)
    if (!acc || acc.expiresAt.getTime() <= now)
      throw new Error("ACCESS_EXPIRED")
  }
  // restricted : AUCUNE re-vérification d'appartenance — la participation in_progress
  // EST l'autorisation (l'utilisateur a pu être retiré de l'audience en cours). (Revue #6.)
}
```

- [ ] **Step 2 : Test** — ajouter à `exam-audience.test.ts` : un membre démarre un examen restreint, est retiré de l'audience (`updateExam` restreint vers une autre liste), puis `finalizeExam` réussit quand même.

- [ ] **Step 3 : Lancer** — Run: `bun run test:integration -- exam-audience` → PASS.

- [ ] **Step 4 : Commit** — `git add features/exams/actions.ts tests/integration/exam-audience.test.ts && git commit -m "feat(exams): finalizeExam tolérant au retrait d'audience (revue #6)"`

---

## Task 8 : Filtre de la liste étudiant

**Files:**

- Modify: `features/exams/dal.ts` (`getExamsWithParticipation`)
- Test: `tests/integration/exam-audience.test.ts`

- [ ] **Step 1 : Test (échec attendu)** — un examen restreint n'apparaît dans `getExamsWithParticipation` que pour un membre (et l'admin), pas pour un outsider.

- [ ] **Step 2 : Lancer (échec)** — FAIL (la liste renvoie tout aujourd'hui).

- [ ] **Step 3 : Implémenter** — ajouter `audienceType` au `select`, et une clause `where` avec EXISTS corrélé :

```ts
import { exists } from "drizzle-orm"

// …
const isAdmin = session?.user?.role === "admin"
const audienceWhere = isAdmin
  ? undefined
  : or(
      eq(exams.audienceType, "subscribers"),
      session?.user
        ? exists(
            db
              .select({ x: sql`1` })
              .from(examAudience)
              .where(
                and(
                  eq(examAudience.examId, exams.id),
                  eq(examAudience.userId, session.user.id),
                ),
              ),
          )
        : sql`false`,
    )
      // …
      .from(exams)
      .where(audienceWhere)
      .orderBy(desc(exams.startDate))
      .limit(100)
```

Importer `examAudience`, `exists`, `or`.

- [ ] **Step 4 : Lancer (succès)** — PASS.

- [ ] **Step 5 : Commit** — `git add features/exams/dal.ts tests/integration/exam-audience.test.ts && git commit -m "feat(exams): liste masque les examens restreints aux non-membres"`

---

## Task 9 : Garde `getExamLeaderboard` (revue #3)

**Files:**

- Modify: `features/exams/dal.ts` (`getExamLeaderboard:959`)
- Test: `tests/integration/exam-audience.test.ts`

- [ ] **Step 1 : Test (échec attendu)** — pour un examen restreint clos, le leaderboard est `[]` pour un non-membre (même avec accès examen actif), non vide pour un membre + admin.

- [ ] **Step 2 : Lancer (échec)** — FAIL.

- [ ] **Step 3 : Implémenter** — ajouter `audienceType` au `select` de l'exam, et dans la branche non-admin, restreindre :

```ts
const [exam] = await db
  .select({ endDate: exams.endDate, audienceType: exams.audienceType })
  .from(exams)
  .where(eq(exams.id, examId))
  .limit(1)
// …
if (!isAdmin) {
  if (!session?.user) return []
  if (Date.now() < exam.endDate.getTime()) return []
  if (exam.audienceType === "restricted") {
    const [m] = await db
      .select({ userId: examAudience.userId })
      .from(examAudience)
      .where(
        and(
          eq(examAudience.examId, examId),
          eq(examAudience.userId, session.user.id),
        ),
      )
      .limit(1)
    if (!m) return []
  } else {
    const [part] = await db
      .select({ id: examParticipations.id })
      .from(examParticipations)
      .where(
        and(
          eq(examParticipations.examId, examId),
          eq(examParticipations.userId, session.user.id),
        ),
      )
      .limit(1)
    if (!part && !(await hasAccess("exam", session.user.id))) return []
  }
}
```

- [ ] **Step 4 : Lancer (succès)** — PASS.

- [ ] **Step 5 : Commit** — `git add features/exams/dal.ts tests/integration/exam-audience.test.ts && git commit -m "feat(exams): leaderboard restreint masqué aux non-membres (revue #3)"`

---

## Task 10 : Picker `<UserMultiSelect>`

**Files:**

- Create: `components/admin/user-multi-select.tsx`

- [ ] **Step 1 : Implémenter** — composant client réutilisant `Command`/`Popover` (porter le pattern de `components/shared/payments/manual-payment-modal.tsx`). Props : `{ value: SelectableUser[]; onChange: (next: SelectableUser[]) => void }`. Recherche serveur **debouncée** (300 ms, pattern `useState+useEffect+setTimeout` — cf. règle data-layer/gotcha) via `loadSearchSelectableUsers`. Affiche les sélectionnés en `Badge` retirables ; coche les résultats déjà sélectionnés. Bornes : afficher un hint si > 50 résultats (« affinez la recherche »).

- [ ] **Step 2 : Vérifier** — Run: `bunx tsc --noEmit && bun run lint` → 0 erreur.

- [ ] **Step 3 : Commit** — `git add components/admin/user-multi-select.tsx && git commit -m "feat(admin): UserMultiSelect recherchable"`

---

## Task 11 : Radio d'audience dans le formulaire examen

**Files:**

- Modify: `app/(admin)/admin/exams/create/_components/exam-create-form.tsx` (+ form d'édition associé)

- [ ] **Step 1 : Ajouter le champ** — un `RadioGroup` « À qui s'adresse cet examen ? » : _Tous les abonnés aux examens blancs_ (`subscribers`, défaut) / _Utilisateurs spécifiques_ (`restricted`). Quand `restricted`, afficher `<UserMultiSelect>`. Câbler `audienceType` + `audienceUserIds` (les ids des sélectionnés) dans la soumission `createExam`/`updateExam`. En édition, pré-charger via `loadExamAudience(examId)`.

- [ ] **Step 2 : Vérifier** — Run: `bunx tsc --noEmit && bun run lint` → 0 erreur ; tester manuellement : restreint sans sélection → erreur de validation (≥1).

- [ ] **Step 3 : Commit** — `git add app/(admin)/admin/exams/ && git commit -m "feat(admin): choix d'audience à la création/édition d'examen"`

---

## Task 12 : Page détail admin — affichage selon l'audience

**Files:**

- Modify: `app/(admin)/admin/exams/[id]/_components/eligible-candidates-section.tsx` (+ sa page)

- [ ] **Step 1 : Adapter** — si `audienceType === "restricted"`, afficher la liste `getExamAudience(examId)` (titre « Utilisateurs autorisés ») ; sinon, l'actuel `getEligibleExamCandidates` (« Abonnés éligibles »). Passer `audienceType` depuis la page (lecture DAL).

- [ ] **Step 2 : Vérifier** — Run: `bunx tsc --noEmit && bun run lint` → 0 erreur.

- [ ] **Step 3 : Commit** — `git add app/(admin)/admin/exams/ && git commit -m "feat(admin): détail examen affiche l'audience selon le type"`

---

## Task 13 : Vérification finale

- [ ] **Step 1 :** Run: `bun run check && bun run test && bun run test:integration` → tout vert.
- [ ] **Step 2 :** Nettoyage `afterAll` du test d'intégration : supprimer `examAudience` (et participations) avant `exams`/`user` selon les FK.
- [ ] **Step 3 : Commit** éventuel des ajustements.

---

## Self-Review (effectuée)

- **Couverture spec :** modèle (T1) · sémantique « sélection = accès » startExam (T6) · finalize tolérant #6 (T7) · liste masquée (T8) · leaderboard #3 (T9) · pool tous utilisateurs (T2/T10) · édition à tout moment (T5) · UI radio+picker (T10/T11) · détail (T12).
- **Placeholders :** les corps de tests « … » (T5, T7-step2) décrivent un scénario précis ; le testeur reproduit le pattern de T4/T6 (code complet fourni). UI (T10/T11) renvoie au composant source à porter avec props précisées.
- **Cohérence des types :** `audienceType`/`audienceUserIds` (T3) consommés tels quels en T4/T5/T11 ; `SelectableUser` réutilisé (users/dal) ; `getExamAudience`/`searchSelectableUsers` signatures stables.
- **Dépendance F1 :** T7 cible `finalizeExam` (F1) — note explicite si F1 non livrée.
