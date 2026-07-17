# Refonte médias — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unifier l'affichage des avatars (`<UserAvatar>`), corriger l'orphelin S3 au remplacement d'avatar, passer `deleteQuestion` en hybride hard/soft arbitré par les FK, et livrer un script d'audit/GC des médias S3.

**Architecture:** Spec validé : `docs/superpowers/specs/2026-07-02-refonte-medias-design.md`. Un composant client unique résout les `user.image` polymorphes au rendu (aucun backfill) ; la suppression de question tente le hard delete et retombe sur le soft à la violation FK (23001 restrict_violation — découvert à l'exécution : pas 23503 ; zéro check applicatif, zéro race) ; un script Bun standalone (dry-run par défaut) audite orphelins/liens cassés et garbage-collecte les questions soft-deleted déréférencées.

**Tech Stack:** Next.js 16 App Router · React 19 · Drizzle/Neon · Radix Avatar (shadcn) · AWS SDK v3 (S3) · Vitest (happy-dom + intégration branche Neon) · Bun.

**Contraintes transverses :**

- `lib/aws.ts` et `lib/storage.ts` importent `server-only` → **interdits d'import dans un script Bun standalone** (le script d'audit crée son propre client S3). Dans vitest, `server-only` est aliasé vers un stub (`vitest.config.ts:144`).
- Gates : `bun run check` (tsc + eslint --max-warnings 0), `bun run test` (JAMAIS `bun test`), `bun run test:integration` (crée/migre/détruit une branche Neon — lance TOUTE la suite intégration à chaque fois, ~1-2 min).
- Prettier import order : 1) node/npm 2) `@/` 3) relatifs.
- Commits conventionnels, **sans attribution Claude**.

---

### Task 1 : `<UserAvatar>` (TDD)

**Files:**

- Create: `components/shared/user-avatar.tsx`
- Test: `tests/components/UserAvatar.test.tsx`

- [ ] **Step 1 : Écrire le test qui échoue**

```tsx
// tests/components/UserAvatar.test.tsx
import { render, screen } from "@testing-library/react"
import { ComponentPropsWithoutRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { UserAvatar } from "@/components/shared/user-avatar"
import { CDN_HOST } from "@/lib/cdn"

// Radix AvatarImage ne rend l'<img> qu'après l'événement `load` (jamais émis en
// happy-dom) → on stubbe les primitives pour tester la résolution d'URL.
vi.mock("@radix-ui/react-avatar", () => ({
  Root: ({ children, ...props }: ComponentPropsWithoutRef<"span">) => (
    <span {...props}>{children}</span>
  ),
  Image: ({ src, alt }: { src?: string; alt?: string }) =>
    src ? <img src={src} alt={alt} data-testid="avatar-img" /> : null,
  Fallback: ({ children, ...props }: ComponentPropsWithoutRef<"span">) => (
    <span data-testid="avatar-fallback" {...props}>
      {children}
    </span>
  ),
}))

// NB : les initiales viennent de `getInitials` (`lib/utils.ts:8`), helper
// canonique déjà couvert par 28 cas dans tests/lib/utils.test.ts — ne PAS
// réinventer ni re-tester ici (revue adversariale, constat 2).

describe("UserAvatar", () => {
  it("résout une clé S3 brute en URL CDN", () => {
    render(<UserAvatar name="Jean Dupont" image="avatars/u1/1.jpg" />)
    expect(screen.getByTestId("avatar-img")).toHaveAttribute(
      "src",
      `https://${CDN_HOST}/avatars/u1/1.jpg`,
    )
  })

  it("laisse passer une URL absolue (Google) telle quelle", () => {
    const url = "https://lh3.googleusercontent.com/a/photo.jpg"
    render(<UserAvatar name="Jean" image={url} />)
    expect(screen.getByTestId("avatar-img")).toHaveAttribute("src", url)
  })

  it("laisse passer un data: URI tel quel", () => {
    const data = "data:image/png;base64,AAAA"
    render(<UserAvatar name="Jean" image={data} />)
    expect(screen.getByTestId("avatar-img")).toHaveAttribute("src", data)
  })

  it("sans image : pas d'<img>, initiales en fallback", () => {
    render(<UserAvatar name="Jean Dupont" image={null} />)
    expect(screen.queryByTestId("avatar-img")).not.toBeInTheDocument()
    expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("JD")
  })
})
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `bun run test tests/components/UserAvatar.test.tsx`
Attendu : FAIL (`Cannot find module '@/components/shared/user-avatar'`).

- [ ] **Step 3 : Implémenter le composant**

```tsx
// components/shared/user-avatar.tsx
"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { resolveAvatarUrl } from "@/lib/cdn"
import { getInitials } from "@/lib/utils"

type UserAvatarProps = {
  name: string | null | undefined
  /** `user.image` polymorphe : clé S3 brute (legacy), URL Google/CDN, data:, ou null. */
  image: string | null | undefined
  /** Classes du conteneur Avatar (taille, ring, border, ombre). */
  className?: string
  /** Classes du fallback initiales (gradient/couleurs du contexte appelant). */
  fallbackClassName?: string
}

/**
 * Avatar utilisateur unique de l'app. Résout les `user.image` polymorphes
 * (clé brute → URL CDN de l'env courant) et rend les initiales en fallback —
 * y compris quand l'image échoue à charger (comportement natif Radix).
 * Toujours utiliser CE composant pour un avatar, jamais `AvatarImage` brut.
 */
export const UserAvatar = ({
  name,
  image,
  className,
  fallbackClassName,
}: UserAvatarProps) => (
  <Avatar className={className}>
    <AvatarImage src={resolveAvatarUrl(image) ?? undefined} alt={name ?? ""} />
    <AvatarFallback className={fallbackClassName}>
      {getInitials(name)}
    </AvatarFallback>
  </Avatar>
)
```

- [ ] **Step 4 : Vérifier le pass**

Run: `bun run test tests/components/UserAvatar.test.tsx`
Attendu : PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add components/shared/user-avatar.tsx tests/components/UserAvatar.test.tsx
git commit -m "feat(avatars): composant UserAvatar unique (résolution polymorphe + initiales)"
```

---

### Task 2 : Migration sites admin « utilisateurs » (4 fichiers)

**Files:**

- Modify: `app/(admin)/admin/utilisateurs/_components/user-table-row.tsx:55-57`
- Modify: `app/(admin)/admin/utilisateurs/_components/users-table.tsx:205-212`
- Modify: `app/(admin)/admin/utilisateurs/_components/user-side-panel.tsx:318-326`
- Modify: `app/(admin)/admin/utilisateurs/[id]/_components/user-info-card.tsx:49-54`

Pour CHAQUE fichier : remplacer l'import `@/components/ui/avatar` par
`import { UserAvatar } from "@/components/shared/user-avatar"`, remplacer le bloc
`<Avatar>…</Avatar>` par le `<UserAvatar …>` ci-dessous, puis **nettoyer ce qui
devient inutilisé** : l'import `getInitials` de `@/lib/utils` (la plupart des
sites l'importent déjà — il vit désormais DANS UserAvatar), les const locales
`initials`, et les imports `cn` orphelins — le lint (`no-unused-vars`) signale
ce qui reste.

- [ ] **Step 1 : `user-table-row.tsx`**

```tsx
<UserAvatar name={user.name} image={user.image} className="h-8 w-8" />
```

- [ ] **Step 2 : `users-table.tsx`**

```tsx
<UserAvatar
  name={user.name}
  image={user.image}
  className="h-9 w-9 border border-gray-100 dark:border-gray-800"
  fallbackClassName="bg-linear-to-br from-blue-500 to-indigo-600 text-xs font-medium text-white"
/>
```

- [ ] **Step 3 : `user-side-panel.tsx`**

```tsx
<UserAvatar
  name={user.name}
  image={user.image}
  className="h-20 w-20 border-4 border-white shadow-lg dark:border-gray-800"
  fallbackClassName="bg-linear-to-br from-blue-500 to-indigo-600 text-xl font-semibold text-white"
/>
```

- [ ] **Step 4 : `user-info-card.tsx`** (supprimer la const `initials` locale,
      lignes 29-35 — son fallback passe de `"U"` à `"?"` : changement cosmétique assumé,
      logique unifiée `getInitials`)

```tsx
<UserAvatar
  name={user.name}
  image={user.image}
  className="h-24 w-24 border-4 border-white shadow-xl dark:border-gray-900"
  fallbackClassName="bg-linear-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white"
/>
```

- [ ] **Step 5 : Vérifier**

Run: `bun run check`
Attendu : PASS (0 erreur, 0 warning).

- [ ] **Step 6 : Commit**

```bash
git add "app/(admin)/admin/utilisateurs"
git commit -m "refactor(avatars): admin/utilisateurs sur UserAvatar"
```

---

### Task 3 : Migration sites admin « examens » (4 fichiers)

**Files:**

- Modify: `app/(admin)/admin/examens/[id]/_components/exam-leaderboard.tsx:123-129`
- Modify: `app/(admin)/admin/examens/[id]/_components/eligible-candidates-section.tsx:168-172`
- Modify: `app/(admin)/admin/examens/[id]/_components/restricted-audience-section.tsx:128-149`
- Modify: `app/(admin)/admin/examens/[id]/resultats/[userId]/_components/participant-results-error.tsx:85-92`

Mêmes règles d'imports/nettoyage que Task 2.

- [ ] **Step 1 : `exam-leaderboard.tsx`** (supprimer la const `initials` locale, ligne 112)

```tsx
<UserAvatar
  name={entry.user?.name}
  image={entry.user?.image}
  className="size-9 shrink-0 @sm:size-10"
/>
```

- [ ] **Step 2 : `eligible-candidates-section.tsx`** (supprimer la const `initials` locale, lignes 148-154)

```tsx
<UserAvatar
  name={user.name}
  image={user.image}
  className="h-12 w-12 border-2 border-teal-100 shadow-sm dark:border-teal-800"
  fallbackClassName="bg-linear-to-br from-teal-500 to-cyan-500 text-sm font-semibold text-white"
/>
```

- [ ] **Step 3 : `restricted-audience-section.tsx`** (12e site, fallback-only —
      `ExamAudienceUser` n'a pas de champ `image`, `features/exams/dal.ts:1086` ; on
      passe `image={null}`, rendu identique. Supprimer la const `initials` inline,
      l.128-134)

```tsx
<UserAvatar
  name={user.name}
  image={null}
  className="h-12 w-12 border-2 border-teal-100 shadow-sm dark:border-teal-800"
  fallbackClassName="bg-linear-to-br from-teal-500 to-cyan-500 text-sm font-semibold text-white"
/>
```

- [ ] **Step 4 : `participant-results-error.tsx`** (supprimer la const `initials` locale, ligne 34)

```tsx
<UserAvatar
  name={participantUser.name}
  image={participantUser.image}
  className="h-16 w-16"
  fallbackClassName="bg-blue-100 text-xl text-blue-700 dark:bg-blue-900 dark:text-blue-300"
/>
```

- [ ] **Step 5 : Vérifier puis committer**

Run: `bun run check` — attendu PASS.

```bash
git add "app/(admin)/admin/examens"
git commit -m "refactor(avatars): admin/examens sur UserAvatar"
```

---

### Task 4 : Migration nav/marketing/quiz (4 fichiers) + suppression code mort

**Files:**

- Modify: `components/shared/generic-nav-user.tsx:133-155,175-195` (2 blocs)
- Modify: `components/marketing-header/index.tsx:159-167`
- Modify: `components/marketing-header/mobile-menu.tsx:151-159`
- Modify: `components/quiz/results/session-results.tsx:258-266`
- Delete: `app/(admin)/admin/utilisateurs/_components/user-details-dialog.tsx` (code mort — exporté, jamais importé ; rendait `user.image` brut via next/image)

- [ ] **Step 1 : `generic-nav-user.tsx` — bloc 1 (trigger, l.133-155)**

Garder le `cn(...)` existant, déplacé dans les props :

```tsx
<UserAvatar
  name={currentUser.name}
  image={currentUser.image}
  className={cn(
    "ring-offset-sidebar h-9 w-9 rounded-lg ring-2 ring-offset-2 transition-all",
    requireAdmin
      ? "ring-orange-500/30 group-hover/avatar:ring-orange-500/50"
      : "ring-blue-500/30 group-hover/avatar:ring-blue-500/50",
  )}
  fallbackClassName={cn(
    "rounded-lg font-semibold",
    requireAdmin
      ? "bg-linear-to-br from-orange-500 to-amber-500 text-white"
      : "bg-linear-to-br from-blue-500 to-indigo-500 text-white",
  )}
/>
```

- [ ] **Step 2 : `generic-nav-user.tsx` — bloc 2 (dropdown, l.175-195)**

```tsx
<UserAvatar
  name={currentUser.name}
  image={currentUser.image}
  className={cn(
    "h-10 w-10 rounded-lg ring-2",
    requireAdmin ? "ring-orange-500/30" : "ring-blue-500/30",
  )}
  fallbackClassName={cn(
    "rounded-lg font-semibold",
    requireAdmin
      ? "bg-linear-to-br from-orange-500 to-amber-500 text-white"
      : "bg-linear-to-br from-blue-500 to-indigo-600 text-white",
  )}
/>
```

Supprimer la fonction locale `getInitials` (l.102-109) si plus utilisée ailleurs
dans le fichier.

- [ ] **Step 3 : `marketing-header/index.tsx`**

Nota : le fallback passe de `charAt(0)`/`"U"` à 2 initiales/`"?"` — changement
visuel assumé (spec : logique unifiée).

```tsx
<UserAvatar
  name={currentUser.name}
  image={currentUser.image}
  className="size-10 transition-transform duration-300 hover:scale-105"
  fallbackClassName="bg-linear-to-br from-blue-600 to-indigo-600 text-white"
/>
```

- [ ] **Step 4 : `marketing-header/mobile-menu.tsx`**

```tsx
<UserAvatar
  name={currentUser.name}
  image={currentUser.image}
  className="size-11 border-2 border-white shadow-md dark:border-gray-900"
  fallbackClassName="bg-linear-to-br from-blue-600 to-indigo-600 text-sm font-semibold text-white"
/>
```

- [ ] **Step 5 : `session-results.tsx`** (supprimer la const `initials`, ligne 240)

```tsx
<UserAvatar
  name={participant.name}
  image={participant.image}
  className="h-14 w-14"
  fallbackClassName="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
/>
```

- [ ] **Step 6 : Supprimer le code mort**

```bash
git rm "app/(admin)/admin/utilisateurs/_components/user-details-dialog.tsx"
```

- [ ] **Step 7 : Vérifier puis committer**

Run: `bun run check && bun run test`
Attendu : PASS (les tests existants de `session-results`/quiz ne montent pas ces
blocs avatar directement ; en cas d'échec sur un mock Radix manquant, appliquer
le même `vi.mock("@radix-ui/react-avatar", …)` que Task 1).

```bash
git add -A
git commit -m "refactor(avatars): nav/marketing/quiz sur UserAvatar + suppression user-details-dialog (code mort)"
```

---

### Task 5 : Revert du primitif `ui/avatar.tsx` au stock shadcn

**Files:**

- Modify: `components/ui/avatar.tsx`

- [ ] **Step 1 : Vérifier qu'aucun site ne dépend plus de la normalisation**

Run: `grep -rn "AvatarImage" --include="*.tsx" app components hooks`
Attendu : occurrences UNIQUEMENT dans `components/ui/avatar.tsx` et
`components/shared/user-avatar.tsx`. Toute autre occurrence = site oublié →
retour aux Tasks 2-4.

- [ ] **Step 2 : Restaurer le fichier stock** (= fichier actuel MOINS l'import
      `resolveAvatarUrl` et l'interception de `src`)

```tsx
// components/ui/avatar.tsx — remplacer AvatarImage par la version stock :
function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}
```

Et supprimer la ligne `import { resolveAvatarUrl } from "@/lib/cdn"`.

- [ ] **Step 3 : Vérifier puis committer**

Run: `bun run check && bun run test` — attendu PASS.

```bash
git add components/ui/avatar.tsx
git commit -m "refactor(avatars): ui/avatar.tsx revient au stock shadcn (résolution déplacée dans UserAvatar)"
```

---

### Task 6 : `avatarStoragePathFromImageValue` dans `lib/cdn.ts` (TDD)

La fonction remplace `avatarStoragePathFromUrl` (`lib/storage.ts:117-130`). Elle
vit dans `lib/cdn.ts` (pure, sans `server-only` ni env serveur → testable en
unit et importable par le script d'audit).

**Files:**

- Modify: `lib/cdn.ts`
- Modify: `lib/storage.ts` (suppression de `avatarStoragePathFromUrl` + import `CDN_HOST` devenu inutile)
- Modify: `features/users/actions.ts:209-212` (swap d'appel + garde anti-IDOR + imports)
- Modify: `tests/lib/cdn.test.ts` (**fichier EXISTANT** — teste déjà `cdnUrl` +
  `resolveAvatarUrl` : AJOUTER, ne pas écraser)
- Modify: `tests/lib/storage.test.ts` (retirer l'import et le
  `describe("avatarStoragePathFromUrl")`, l.77-93 — sinon `bun run test` rouge)

- [ ] **Step 1 : Compléter le test existant (nouveau describe qui échoue)**

Dans `tests/lib/cdn.test.ts` (existant) : ajouter
`avatarStoragePathFromImageValue` à l'import de `@/lib/cdn`, compléter le
describe `resolveAvatarUrl` avec les cas protocole-relatif et `data:` s'ils
manquent, puis AJOUTER ce describe à la fin :

```ts
describe("avatarStoragePathFromImageValue", () => {
  it("clé brute avatars/ → telle quelle", () => {
    expect(avatarStoragePathFromImageValue("avatars/u/1.jpg")).toBe(
      "avatars/u/1.jpg",
    )
  })

  it("URL CDN courante → path", () => {
    expect(avatarStoragePathFromImageValue(cdnUrl("avatars/u/1.jpg"))).toBe(
      "avatars/u/1.jpg",
    )
  })

  it("URL d'un AUTRE host → path quand même (delete par clé = no-op cross-env)", () => {
    expect(
      avatarStoragePathFromImageValue(
        "https://dn5nrir6z5nr7.cloudfront.net/avatars/u/1.jpg",
      ),
    ).toBe("avatars/u/1.jpg")
  })

  it("URL Google → null (path hors avatars/)", () => {
    expect(
      avatarStoragePathFromImageValue("https://lh3.googleusercontent.com/a/x"),
    ).toBeNull()
  })

  it("data:, null, vide → null", () => {
    expect(
      avatarStoragePathFromImageValue("data:image/png;base64,AA"),
    ).toBeNull()
    expect(avatarStoragePathFromImageValue(null)).toBeNull()
    expect(avatarStoragePathFromImageValue("")).toBeNull()
  })

  it("traversée / hors préfixe → null", () => {
    expect(avatarStoragePathFromImageValue("avatars/../secret")).toBeNull()
    expect(avatarStoragePathFromImageValue("questions/q/1.jpg")).toBeNull()
    expect(
      avatarStoragePathFromImageValue(`https://${CDN_HOST}/questions/q/1.jpg`),
    ).toBeNull()
  })
})
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `bun run test tests/lib/cdn.test.ts`
Attendu : FAIL sur le nouveau describe uniquement (`avatarStoragePathFromImageValue`
n'existe pas) — les describe `cdnUrl`/`resolveAvatarUrl` existants restent verts.

- [ ] **Step 3 : Implémenter dans `lib/cdn.ts`** (ajout en fin de fichier)

```ts
/**
 * Chemin S3 d'un avatar À NOUS à partir d'une valeur `user.image` polymorphe :
 * clé brute (`avatars/…`) telle quelle ; URL http(s) dont le path commence par
 * `avatars/` — quel que soit le host CDN (le delete opère par clé dans le
 * bucket de l'ENV courant : objet d'un autre env absent → no-op). `null` pour
 * tout le reste (URL Google, `data:`, vide) → on ne supprime jamais un fichier
 * qui ne nous appartient pas.
 */
export const avatarStoragePathFromImageValue = (
  value: string | null | undefined,
): string | null => {
  if (!value || value.startsWith("data:")) return null
  let path = value
  if (/^https?:\/\//.test(value)) {
    try {
      path = decodeURIComponent(new URL(value).pathname).replace(/^\/+/, "")
    } catch {
      return null
    }
  }
  if (!path.startsWith("avatars/") || path.includes("..")) return null
  return path
}
```

- [ ] **Step 4 : Vérifier le pass**

Run: `bun run test tests/lib/cdn.test.ts` — attendu PASS.

- [ ] **Step 5 : Brancher `confirmAvatarUpload` (avec garde anti-IDOR) et supprimer l'ancienne fonction**

Dans `features/users/actions.ts`, remplacer les lignes 209-212 par :

```ts
// Anti-IDOR (durcissement revue) : ne supprimer l'ancien objet que dans le
// préfixe de l'utilisateur COURANT — une valeur `user.image` forgée (endpoint
// Better Auth /update-user) ne peut pas faire supprimer l'avatar d'un tiers.
// Coût : un legacy `avatars/<autre-id>/…` (id pré-migration) n'est pas purgé
// ici — le script d'audit (Task 9) le rattrape.
const oldPath = avatarStoragePathFromImageValue(current?.image)
if (
  oldPath?.startsWith(`avatars/${userId}/`) &&
  oldPath !== input.storagePath
) {
  await tryDeleteFromStorage(oldPath)
}
```

Imports : retirer `avatarStoragePathFromUrl` de l'import `@/lib/storage`,
ajouter `avatarStoragePathFromImageValue` à l'import `@/lib/cdn` (qui contient
déjà `cdnUrl`).

Dans `lib/storage.ts` : supprimer `avatarStoragePathFromUrl` (l.111-130) et
l'import `CDN_HOST` de `@/lib/cdn` (devenu inutile).

Dans `tests/lib/storage.test.ts` : retirer `avatarStoragePathFromUrl` de
l'import (l.4) et supprimer le `describe("avatarStoragePathFromUrl", …)`
(l.77-93) — ses cas sont couverts en superset par le nouveau describe de
`cdn.test.ts`.

Run: `grep -rn "avatarStoragePathFromUrl" --include="*.ts*" .`
Attendu : zéro occurrence.

- [ ] **Step 6 : Vérifier puis committer**

Run: `bun run check && bun run test` — attendu PASS.

```bash
git add lib/cdn.ts lib/storage.ts features/users/actions.ts tests/lib/cdn.test.ts tests/lib/storage.test.ts
git commit -m "fix(avatars): suppression de l'ancien avatar legacy au remplacement + garde anti-IDOR sur le préfixe user"
```

---

### Task 7 : `deleteQuestion` hybride hard/soft (TDD intégration)

**Files:**

- Modify: `features/questions/actions.ts:250-271` (+ helper `isForeignKeyViolation`)
- Modify: `app/(admin)/admin/questions/_components/question-side-panel.tsx:120-132` (toast différencié)
- Modify: `tests/integration/questions-actions.test.ts:120-130` (test « soft delete » existant à repointer — la question qu'il crée n'est jamais référencée, elle part désormais en HARD)
- Test: `tests/integration/delete-question.test.ts`

- [ ] **Step 1 : Écrire le test d'intégration qui échoue**

```ts
// tests/integration/delete-question.test.ts
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import {
  examQuestions,
  exams,
  questionImages,
  questions,
  user,
} from "@/db/schema"
import { deleteQuestion } from "@/features/questions/actions"
import { requireRole } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"
import { tryDeleteFromStorage } from "@/lib/storage"

vi.mock("@/lib/auth-guards", () => ({ requireRole: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
// S3 jamais touché par les tests : on stubbe la suppression best-effort.
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  tryDeleteFromStorage: vi.fn().mockResolvedValue(undefined),
}))

const adminId = createId()
const qFree = createId() // jamais référencée → hard delete attendu
const qUsed = createId() // référencée par un examen → soft delete attendu
const examId = createId()
const DAY = 24 * 60 * 60 * 1000

const mkQuestion = (id: string, label: string) => ({
  id,
  question: `Question ${label} ?`,
  correctAnswer: "A",
  options: ["A", "B"],
  objectifCmc: "Objectif IT",
  domain: "Cardiologie",
})

beforeAll(async () => {
  vi.mocked(requireRole).mockResolvedValue({
    user: { id: adminId, role: "admin" },
  } as never)

  await db.insert(user).values({
    id: adminId,
    name: "Admin Test",
    email: `${adminId}@test.invalid`,
  })
  await db
    .insert(questions)
    .values([mkQuestion(qFree, "libre"), mkQuestion(qUsed, "utilisée")])
  await db.insert(questionImages).values([
    {
      questionId: qFree,
      storagePath: `questions/${qFree}/1-0.jpg`,
      position: 0,
      kind: "statement" as const,
    },
    {
      questionId: qUsed,
      storagePath: `questions/${qUsed}/1-0.jpg`,
      position: 0,
      kind: "statement" as const,
    },
  ])
  const now = Date.now()
  await db.insert(exams).values({
    id: examId,
    title: "[IT] delete-question",
    startDate: new Date(now - DAY),
    endDate: new Date(now + DAY),
    completionTime: 3600,
    createdBy: adminId,
  })
  await db
    .insert(examQuestions)
    .values({ examId, questionId: qUsed, position: 0 })
})

afterAll(async () => {
  // Enfants avant parents (FK restrict).
  await db.delete(examQuestions).where(eq(examQuestions.examId, examId))
  await db.delete(exams).where(eq(exams.id, examId))
  await db.delete(questions).where(eq(questions.id, qUsed)) // cascade images
  await db.delete(questions).where(eq(questions.id, qFree)) // no-op si hard OK
  await db.delete(user).where(eq(user.id, adminId))
})

describe("deleteQuestion (hybride hard/soft)", () => {
  it("hard delete + purge S3 quand la question n'est référencée nulle part", async () => {
    const res = await deleteQuestion(qFree)
    expect(res).toEqual({ success: true, mode: "hard" })

    const rows = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, qFree))
    expect(rows).toHaveLength(0)
    expect(vi.mocked(tryDeleteFromStorage)).toHaveBeenCalledWith(
      `questions/${qFree}/1-0.jpg`,
    )
  })

  it("soft delete quand la question est référencée — médias DB et S3 conservés", async () => {
    vi.mocked(tryDeleteFromStorage).mockClear()
    const res = await deleteQuestion(qUsed)
    expect(res).toEqual({ success: true, mode: "soft" })

    const [row] = await db
      .select({ deletedAt: questions.deletedAt })
      .from(questions)
      .where(eq(questions.id, qUsed))
    expect(row?.deletedAt).not.toBeNull()

    const imgs = await db
      .select({ id: questionImages.id })
      .from(questionImages)
      .where(eq(questionImages.questionId, qUsed))
    expect(imgs).toHaveLength(1)
    expect(vi.mocked(tryDeleteFromStorage)).not.toHaveBeenCalled()
  })

  it("échoue proprement sur une question inexistante ou déjà supprimée", async () => {
    const res = await deleteQuestion(createId())
    expect(res.success).toBe(false)

    const again = await deleteQuestion(qUsed) // déjà soft-deleted
    expect(again.success).toBe(false)
  })
})
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `bun run test:integration`
Attendu : FAIL sur `delete-question.test.ts` (le `mode` n'existe pas encore ;
l'actuel `deleteQuestion` soft-delete aussi `qFree`). Les autres fichiers de la
suite doivent rester verts.

- [ ] **Step 3 : Implémenter l'action**

Dans `features/questions/actions.ts`, remplacer `deleteQuestion` (l.250-271) par :

```ts
/**
 * Violation de contrainte FK Postgres. `ON DELETE RESTRICT` lève `23001`
 * (restrict_violation) — PAS `23503` (foreign_key_violation, inserts/NO ACTION,
 * découvert au test d'intégration) ; on accepte les deux. Drizzle enveloppe
 * l'erreur pg (DrizzleQueryError → cause) : on remonte la chaîne `cause` (bornée).
 */
const FK_VIOLATION_CODES = new Set(["23001", "23503"])

const isForeignKeyViolation = (error: unknown): boolean => {
  let cur: unknown = error
  for (let i = 0; i < 5 && cur; i++) {
    if (
      typeof cur === "object" &&
      "code" in cur &&
      typeof (cur as { code?: unknown }).code === "string" &&
      FK_VIOLATION_CODES.has((cur as { code: string }).code)
    ) {
      return true
    }
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}

export type DeleteQuestionResult =
  { success: true; mode: "hard" | "soft" } | { success: false; error: string }

/**
 * [Admin] Suppression HYBRIDE. On TENTE le hard delete ; les FK `restrict`
 * (exam_questions, exam_answers, training_session_items) arbitrent atomiquement :
 * - non référencée → DELETE passe : cascade DB (images/explication) + purge S3
 *   best-effort après commit ;
 * - référencée → Postgres lève 23001 → fallback SOFT delete (`deletedAt`),
 *   médias DB/S3 CONSERVÉS (encore servis en passation/correction — exams/dal
 *   ne filtre pas `deletedAt`).
 * Aucun check applicatif préalable → aucune race avec une insertion concurrente.
 * Course résiduelle assumée : un `setQuestionImages` concurrent qui commit entre
 * la collecte des chemins et le DELETE peut laisser un orphelin S3 (fenêtre
 * minuscule, purge best-effort) — rattrapé par `bun run audit:medias`.
 */
export const deleteQuestion = async (
  id: string,
): Promise<DeleteQuestionResult> => {
  await requireRole(["admin"])
  if (!id) return fail("Question requise")

  try {
    const imagePaths = await db.transaction(async (tx) => {
      const imgs = await tx
        .select({ storagePath: questionImages.storagePath })
        .from(questionImages)
        .where(eq(questionImages.questionId, id))
      const res = await tx
        .delete(questions)
        .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
        .returning({ id: questions.id })
      if (res.length === 0) throw new Error("Q_NOT_FOUND")
      return imgs.map((i) => i.storagePath)
    })

    // Hard delete commité : purge S3 best-effort (hors transaction).
    await Promise.all(imagePaths.map((p) => tryDeleteFromStorage(p)))
    revalidatePath("/admin/questions")
    return { success: true, mode: "hard" }
  } catch (error) {
    if (error instanceof Error && error.message === "Q_NOT_FOUND") {
      return fail("Question introuvable")
    }
    if (!isForeignKeyViolation(error)) {
      logDev("[deleteQuestion]", error)
      return fail("Erreur serveur. Réessayez.")
    }
  }

  try {
    const res = await db
      .update(questions)
      .set({ deletedAt: new Date() })
      .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
      .returning({ id: questions.id })
    if (res.length === 0) return fail("Question introuvable")

    revalidatePath("/admin/questions")
    return { success: true, mode: "soft" }
  } catch (error) {
    logDev("[deleteQuestion]", error)
    return fail("Erreur serveur. Réessayez.")
  }
}
```

- [ ] **Step 4 : Repointer le test « soft delete » existant**

Dans `tests/integration/questions-actions.test.ts` (l.120-130), le test de
suppression crée une question **jamais référencée** : avec l'hybride elle part
en HARD delete — l'intitulé « soft » et l'intention « conserve la ligne »
deviennent faux (test vert trompeur). Mettre à jour : renommer l'`it` en
`"hard delete d'une question jamais référencée"`, asserter
`expect(res).toEqual({ success: true, mode: "hard" })`, et remplacer toute
assertion « la ligne existe encore avec deletedAt » par une vérification
d'absence de ligne. La couverture du chemin SOFT vit dans
`tests/integration/delete-question.test.ts` (Step 1).

- [ ] **Step 5 : Vérifier le pass**

Run: `bun run test:integration`
Attendu : PASS sur toute la suite (dont `delete-question.test.ts` et
`questions-actions.test.ts` repointé).

- [ ] **Step 6 : Toast différencié dans le panel admin**

Dans `app/(admin)/admin/questions/_components/question-side-panel.tsx`,
remplacer le corps de `handleDelete` (l.120-132) :

```tsx
const handleDelete = async () => {
  setIsDeleting(true)
  const res = await deleteQuestion(questionId)
  setIsDeleting(false)
  if (!res.success) {
    toast.error(res.error ?? "Erreur lors de la suppression")
    return
  }
  toast.success(
    res.mode === "hard"
      ? "Question supprimée définitivement"
      : "Question archivée : référencée par des examens ou entraînements — médias conservés",
  )
  setShowDeleteDialog(false)
  reload()
  onDeleted?.()
}
```

- [ ] **Step 7 : Vérifier puis committer**

Run: `bun run check && bun run test` — attendu PASS.

```bash
git add features/questions/actions.ts "app/(admin)/admin/questions" tests/integration/delete-question.test.ts tests/integration/questions-actions.test.ts
git commit -m "feat(questions): suppression hybride hard/soft arbitrée par les FK (23001/23503) + purge S3 au hard delete"
```

---

### Task 8 : `lib/media-audit.ts` — logique pure d'audit (TDD)

**Files:**

- Create: `lib/media-audit.ts`
- Test: `tests/lib/media-audit.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// tests/lib/media-audit.test.ts
import { describe, expect, it } from "vitest"
import { CDN_HOST } from "@/lib/cdn"
import {
  classifyImageValue,
  diffMediaRefs,
  referencedAvatarKeys,
} from "@/lib/media-audit"

describe("classifyImageValue", () => {
  it("classe chaque forme de user.image", () => {
    expect(classifyImageValue(null)).toBe("empty")
    expect(classifyImageValue("")).toBe("empty")
    expect(classifyImageValue("data:image/png;base64,AA")).toBe("data")
    expect(classifyImageValue("https://lh3.googleusercontent.com/a/x")).toBe(
      "google",
    )
    expect(classifyImageValue(`https://${CDN_HOST}/avatars/u/1.jpg`)).toBe(
      "cdn-url",
    )
    expect(
      classifyImageValue(
        "https://dn5nrir6z5nr7.cloudfront.net/avatars/u/1.jpg",
      ),
    ).toBe("cdn-url")
    expect(classifyImageValue("avatars/u/1.jpg")).toBe("raw-key")
    expect(classifyImageValue("https://exemple.test/photo.jpg")).toBe(
      "external",
    )
  })
})

describe("diffMediaRefs", () => {
  it("sépare orphelins S3 et liens cassés DB", () => {
    const { orphans, broken } = diffMediaRefs(
      ["avatars/a/1.jpg", "avatars/b/1.jpg"],
      ["avatars/b/1.jpg", "questions/q/1.jpg"],
    )
    expect(orphans).toEqual(["avatars/a/1.jpg"])
    expect(broken).toEqual(["questions/q/1.jpg"])
  })

  it("vide → vide", () => {
    expect(diffMediaRefs([], [])).toEqual({ orphans: [], broken: [] })
  })
})

describe("referencedAvatarKeys", () => {
  it("extrait et déduplique les clés de NOS avatars", () => {
    expect(
      referencedAvatarKeys([
        "avatars/u/1.jpg",
        `https://${CDN_HOST}/avatars/u/1.jpg`, // même clé → dédupliquée
        "https://lh3.googleusercontent.com/a/x", // externe → ignorée
        null,
      ]),
    ).toEqual(["avatars/u/1.jpg"])
  })
})
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `bun run test tests/lib/media-audit.test.ts`
Attendu : FAIL (module inexistant).

- [ ] **Step 3 : Implémenter**

```ts
// lib/media-audit.ts
// Logique PURE de l'audit médias — AUCUN import `server-only`/env serveur :
// consommée par le script standalone `scripts/audit-medias.ts` ET testée en unit.
import { avatarStoragePathFromImageValue } from "@/lib/cdn"

export type ImageValueKind =
  "empty" | "data" | "google" | "cdn-url" | "raw-key" | "external"

/** Classe une valeur `user.image` polymorphe (inventaire d'audit). */
export const classifyImageValue = (
  value: string | null | undefined,
): ImageValueKind => {
  if (!value) return "empty"
  if (value.startsWith("data:")) return "data"
  if (/^https?:\/\//.test(value)) {
    try {
      const url = new URL(value)
      if (url.hostname.endsWith("googleusercontent.com")) return "google"
      const path = url.pathname.replace(/^\/+/, "")
      if (path.startsWith("avatars/") || path.startsWith("questions/")) {
        return "cdn-url"
      }
      return "external"
    } catch {
      return "external"
    }
  }
  if (value.startsWith("avatars/")) return "raw-key"
  return "external"
}

export type MediaDiff = { orphans: string[]; broken: string[] }

/**
 * Diff clé-à-clé : `orphans` = objets S3 sans référence DB ;
 * `broken` = références DB sans objet S3 (liens cassés).
 */
export const diffMediaRefs = (
  s3Keys: Iterable<string>,
  dbPaths: Iterable<string>,
): MediaDiff => {
  const s3 = new Set(s3Keys)
  const refs = new Set(dbPaths)
  const orphans: string[] = []
  for (const key of s3) if (!refs.has(key)) orphans.push(key)
  const broken: string[] = []
  for (const path of refs) if (!s3.has(path)) broken.push(path)
  return { orphans: orphans.sort(), broken: broken.sort() }
}

/** Clés S3 référencées par un lot de `user.image` (nos avatars uniquement, dédupliquées). */
export const referencedAvatarKeys = (
  images: Array<string | null | undefined>,
): string[] => {
  const keys = new Set<string>()
  for (const img of images) {
    const key = avatarStoragePathFromImageValue(img)
    if (key) keys.add(key)
  }
  return [...keys].sort()
}
```

- [ ] **Step 4 : Vérifier le pass puis committer**

Run: `bun run test tests/lib/media-audit.test.ts` — attendu PASS.

```bash
git add lib/media-audit.ts tests/lib/media-audit.test.ts
git commit -m "feat(medias): fonctions pures d'audit (classification user.image, diff S3/DB)"
```

---

### Task 9 : Script `scripts/audit-medias.ts` + entrée package.json

**Files:**

- Create: `scripts/audit-medias.ts`
- Modify: `package.json` (scripts)

⚠️ **Prérequis manuel (hors code)** : la clé IAM dev est write-only. Ajouter à sa
policy `s3:ListBucket` sur le bucket dev (et idéalement
`s3:GetLifecycleConfiguration`). Sans cela, le script échoue proprement avec
`AccessDenied` — le noter dans le rapport d'exécution, pas bloquant pour le
commit du code.

- [ ] **Step 1 : Écrire le script**

```ts
// scripts/audit-medias.ts
/**
 * Audit / GC des médias S3 (avatars + images de questions). DRY-RUN PAR DÉFAUT.
 *
 * Usage :
 *   bun run audit:medias             # rapport seul (aucune écriture)
 *   bun run audit:medias -- --purge  # purge orphelins >24h + GC questions
 *                                    # soft-deleted déréférencées
 *
 * Env requis (COMPLET) : DATABASE_URL, S3_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID,
 * AWS_SECRET_ACCESS_KEY (avec s3:ListBucket ; s3:DeleteObject pour --purge).
 *
 * Audit PROD (lecture seule) : pointer DATABASE_URL sur une BRANCHE Neon créée
 * depuis la prod (jamais la prod primaire) + credentials S3 de liste read-only.
 * Le script affiche sa CIBLE (bucket + host DB) au démarrage — vérifier cette
 * ligne avant de continuer (dotenv comble les vars absentes avec `.env.local`,
 * une omission ferait fuiter la cible DEV en silence).
 *
 * N'importe NI lib/aws.ts / lib/storage.ts (`server-only` interdit hors Next),
 * NI @/db (son import de lib/env/server exigerait TOUT le schéma d'env —
 * DATABASE_URL_UNPOOLED, BETTER_AUTH_SECRET…) : client S3 et pool pg locaux.
 */
import {
  DeleteObjectCommand,
  GetBucketLifecycleConfigurationCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3"
import { config } from "dotenv"
import { and, eq, isNotNull, notExists, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "../db/schema"
import {
  classifyImageValue,
  diffMediaRefs,
  referencedAvatarKeys,
} from "../lib/media-audit"

config({ path: ".env.local" })
config()

const {
  examAnswers,
  examQuestions,
  questionImages,
  questions,
  trainingSessionItems,
  user,
} = schema

const PURGE = process.argv.includes("--purge")
const MIN_AGE_MS = 24 * 60 * 60 * 1000 // jamais purger un objet < 24 h

const dbUrl = process.env.DATABASE_URL
const region = process.env.S3_REGION
const bucket = process.env.S3_BUCKET
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
if (!dbUrl || !region || !bucket || !accessKeyId || !secretAccessKey) {
  console.error(
    "Env manquant (DATABASE_URL, S3_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).",
  )
  process.exit(1)
}

// Cible affichée pour confirmation visuelle (anti-fuite d'env dev en run prod).
console.log(
  `Cible : bucket=${bucket} · db=${new URL(dbUrl).hostname} · ${PURGE ? "MODE PURGE" : "dry-run"}`,
)

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
})
// Pool pg propre au script (pas de loadServerEnv, pas d'attachDatabasePool).
const pool = new Pool({ connectionString: dbUrl, max: 3 })
const db = drizzle(pool, { schema })

type S3Obj = { key: string; lastModified?: Date }

const listAll = async (prefix: string): Promise<S3Obj[]> => {
  const out: S3Obj[] = []
  let token: string | undefined
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    )
    for (const o of page.Contents ?? []) {
      if (o.Key) out.push({ key: o.Key, lastModified: o.LastModified })
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  return out
}

const deleteKey = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

// ---------- 1. Inventaire DB ----------
const users = await db.select({ image: user.image }).from(user)
const byKind = new Map<string, number>()
for (const u of users) {
  const kind = classifyImageValue(u.image)
  byKind.set(kind, (byKind.get(kind) ?? 0) + 1)
}
console.log(`\n=== user.image (${users.length} users) ===`)
for (const [kind, count] of [...byKind.entries()].sort()) {
  console.log(`  ${kind.padEnd(8)} ${count}`)
}

const imageRows = await db
  .select({ storagePath: questionImages.storagePath })
  .from(questionImages)
const questionPaths = imageRows.map((r) => r.storagePath)
console.log(`\n=== question_images ===\n  ${questionPaths.length} référence(s)`)

// ---------- 2. Diff S3 ↔ DB ----------
const [s3Avatars, s3Questions, s3Tmp] = await Promise.all([
  listAll("avatars/"),
  listAll("questions/"),
  listAll("tmp/"),
])
const s3ByKey = new Map(
  [...s3Avatars, ...s3Questions].map((o) => [o.key, o] as const),
)

const avatarDiff = diffMediaRefs(
  s3Avatars.map((o) => o.key),
  referencedAvatarKeys(users.map((u) => u.image)),
)
const questionDiff = diffMediaRefs(
  s3Questions.map((o) => o.key),
  questionPaths,
)

const report = (
  label: string,
  diff: { orphans: string[]; broken: string[] },
) => {
  console.log(`\n=== ${label} ===`)
  console.log(`  orphelins S3 : ${diff.orphans.length}`)
  for (const k of diff.orphans) console.log(`    - ${k}`)
  console.log(`  liens cassés DB→S3 : ${diff.broken.length}`)
  for (const k of diff.broken) console.log(`    ! ${k}`)
}
report("avatars/", avatarDiff)
report("questions/", questionDiff)
console.log(`\n=== tmp/ ===\n  ${s3Tmp.length} objet(s) (laissés au Lifecycle)`)

// ---------- 3. Règle Lifecycle tmp/ (informatif) ----------
try {
  const lc = await s3.send(
    new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }),
  )
  const tmpRule = lc.Rules?.some(
    (r) =>
      r.Status === "Enabled" &&
      (r.Filter?.Prefix ?? r.Prefix ?? "").startsWith("tmp/"),
  )
  console.log(
    tmpRule
      ? "\nLifecycle tmp/ : règle active ✓"
      : "\n⚠️ Lifecycle tmp/ : AUCUNE règle active — à configurer sur le bucket !",
  )
} catch {
  console.log("\nLifecycle tmp/ : non vérifiable (permission manquante)")
}

// ---------- 4. GC : questions soft-deleted totalement déréférencées ----------
const gcCandidates = await db
  .select({ id: questions.id })
  .from(questions)
  .where(
    and(
      isNotNull(questions.deletedAt),
      notExists(
        db
          .select({ one: sql`1` })
          .from(examQuestions)
          .where(eq(examQuestions.questionId, questions.id)),
      ),
      notExists(
        db
          .select({ one: sql`1` })
          .from(examAnswers)
          .where(eq(examAnswers.questionId, questions.id)),
      ),
      notExists(
        db
          .select({ one: sql`1` })
          .from(trainingSessionItems)
          .where(eq(trainingSessionItems.questionId, questions.id)),
      ),
    ),
  )
console.log(
  `\n=== GC ===\n  ${gcCandidates.length} question(s) soft-deleted déréférencée(s)`,
)

// ---------- 5. Purge (opt-in) ----------
if (!PURGE) {
  console.log("\nDry-run terminé. Relancer avec `-- --purge` pour agir.")
  await pool.end()
  process.exit(0)
}

const now = Date.now()
const purgeable = [...avatarDiff.orphans, ...questionDiff.orphans].filter(
  (key) => {
    const lm = s3ByKey.get(key)?.lastModified
    return lm !== undefined && now - lm.getTime() > MIN_AGE_MS
  },
)
console.log(`\nPurge de ${purgeable.length} orphelin(s) S3 (>24h)…`)
for (const key of purgeable) {
  await deleteKey(key)
  console.log(`  supprimé : ${key}`)
}

for (const q of gcCandidates) {
  const paths = await db
    .select({ storagePath: questionImages.storagePath })
    .from(questionImages)
    .where(eq(questionImages.questionId, q.id))
  // FK restrict = filet : si une référence est apparue entre-temps, ce DELETE
  // lève et le script s'arrête bruyamment (relancer l'audit).
  await db.delete(questions).where(eq(questions.id, q.id))
  for (const p of paths) await deleteKey(p.storagePath)
  console.log(`  GC question ${q.id} (${paths.length} image(s))`)
}

console.log("\nPurge terminée.")
await pool.end()
process.exit(0)
```

- [ ] **Step 2 : Entrée package.json**

Dans `package.json`, section `scripts`, ajouter après `"env:sync"` :

```json
"audit:medias": "bun scripts/audit-medias.ts",
```

- [ ] **Step 3 : Vérifier types/lint**

Run: `bun run check`
Attendu : PASS. (Le script est hors périmètre Next mais couvert par tsc/eslint.)

- [ ] **Step 4 : Dry-run réel en dev**

Run: `bun run audit:medias`
Attendu : rapport complet (inventaire, diffs, statut Lifecycle, candidats GC),
exit 0, **aucune écriture**. Si `AccessDenied` sur ListObjectsV2 → faire le
prérequis IAM (ajouter `s3:ListBucket` à la clé dev) et relancer.

- [ ] **Step 5 : Commit**

```bash
git add scripts/audit-medias.ts package.json
git commit -m "feat(medias): script d'audit/GC des orphelins S3 (dry-run par défaut, --purge opt-in)"
```

---

### Task 10 : Documentation des patterns + gates finaux

**Files:**

- Modify: `.claude/rules/data-layer.md` (section « Upload médias » ou à la suite)

- [ ] **Step 1 : Ajouter les deux règles**

```md
- **Avatars** : toujours `<UserAvatar name image className fallbackClassName>`
  (`components/shared/user-avatar.tsx`) — JAMAIS `AvatarImage src={user.image}`
  brut ni `next/image` sur `user.image` (valeur polymorphe : clé S3 brute
  legacy, URL Google/CDN, `data:`). Le primitif `ui/avatar.tsx` est du shadcn
  stock, sans logique CDN.
- **Suppression de question = hybride** (`deleteQuestion`) : on TENTE le hard
  delete, arbitré par les FK `restrict` (23001 → fallback soft delete ; aucun
  check applicatif → aucune race). Hard = cascade DB + purge S3 best-effort ;
  soft = médias CONSERVÉS (encore servis en passation/correction : `exams/dal`
  ne filtre pas `deletedAt`, c'est voulu). Audit/GC des orphelins :
  `bun run audit:medias` (dry-run ; `--purge` explicite).
```

- [ ] **Step 2 : Gates finaux sur l'ensemble**

Run: `bun run check && bun run test && bun run test:integration`
Attendu : tout PASS (coverage ≥ seuils).

- [ ] **Step 3 : Commit**

```bash
git add .claude/rules/data-layer.md
git commit -m "docs(rules): patterns UserAvatar + suppression hybride des questions"
```

---

### Task 11 : Runbook audit PROD (exécution post-merge, lecture seule)

Aucun code — checklist à dérouler quand le reste est mergé/déployé :

- [ ] **Step 1** : Créer une **branche Neon éphémère depuis la PROD** (dashboard
      Neon → Branches → New branch, parent = prod ; conformément à la préférence
      « opérations prod via dashboard »). Récupérer sa connection string.
- [ ] **Step 2** : Créer des credentials IAM **read-list-only** sur le bucket
      prod (policy : `s3:ListBucket` + `s3:GetLifecycleConfiguration` uniquement,
      PAS de Get/Put/DeleteObject).
- [ ] **Step 3** : Exécuter le dry-run contre ces cibles (PowerShell). Les CINQ
      vars doivent être posées — une var omise serait comblée en silence par
      `.env.local` (dev) via dotenv :

```powershell
$env:DATABASE_URL = "<connection string de la BRANCHE Neon>"
$env:S3_BUCKET = "<bucket prod>"; $env:S3_REGION = "<région prod>"
$env:AWS_ACCESS_KEY_ID = "<clé read-list>"; $env:AWS_SECRET_ACCESS_KEY = "<secret>"
bun scripts/audit-medias.ts
```

**Vérifier la 1re ligne de sortie** (`Cible : bucket=… · db=…`) : elle doit
afficher le bucket PROD et le host de la BRANCHE Neon — sinon STOP (fuite
d'env dev).

- [ ] **Step 4** : Archiver le rapport (comptes `user.image` par forme,
      orphelins par préfixe, liens cassés, statut Lifecycle `tmp/`) et **supprimer
      la branche Neon**. Toute purge prod = décision séparée, avec des credentials
      incluant `s3:DeleteObject` et `DATABASE_URL` pointé sur la prod réelle,
      jamais dans la même session que l'audit.

---

## Auto-revue du plan (rédaction) + intégration de la revue adversariale (2026-07-02)

- **Couverture spec** : §A → Tasks 1-5 ; §B (fix remplacement) → Task 6 ;
  §C (hybride) → Task 7 ; §D (audit/GC + Lifecycle + IAM) → Tasks 8-9 ;
  §E (prod) → Task 11 ; impact tests → Tasks 1, 6, 7, 8 ; docs → Task 10.
- **Écarts assumés vs spec initial** : prop `fallbackClassName` sur `UserAvatar`
  (styles de fallback différents par site — parité visuelle) ;
  `avatarStoragePathFromImageValue` dans `lib/cdn.ts` (pure, sans `server-only`
  → testable en unit + importable par le script).
- **Correctifs intégrés de la revue adversariale de design** (rapport trié puis
  supprimé) : réutilisation de `getInitials` (`lib/utils.ts:8`) au lieu d'un
  nouveau `initials()` (Task 1) ; `tests/lib/storage.test.ts` ajouté aux
  éditions et `tests/lib/cdn.test.ts` traité en FUSION, pas en création
  (Task 6) ; garde anti-IDOR `avatars/{userId}/` sur `oldPath` (Task 6) ;
  repointage du test intégration « soft delete » existant (Task 7) ; script
  d'audit avec pool pg/drizzle PROPRE au lieu d'importer `@/db` → env requis
  réduit et exact, + affichage de la cible anti-fuite dev (Tasks 9/11) ;
  12e site avatar `restricted-audience-section.tsx` migré (Task 3) ; course
  résiduelle hard-delete↔`setQuestionImages` documentée et assumée (audit en
  filet, Task 7).
- **Types** : `DeleteQuestionResult` (Task 7) consommé par le toast (narrowing
  après `!res.success`) ; `UserAvatar` seul export composant, initiales via
  `getInitials` partagé (Task 1) ; `diffMediaRefs(s3Keys, dbPaths)` signature
  identique Tasks 8/9.
