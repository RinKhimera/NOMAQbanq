# Robustesse réseau des appels client de Server Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aucun `await` nu de Server Action côté client : les rejets réseau (« Failed to fetch », Sentry NOMAQBANQ-1A) deviennent des `{ success: false, error }` gérés par les branches d'erreur existantes — plus d'unhandled rejection, de spinner figé ni de réponse d'examen perdue en silence.

**Architecture:** Un helper client `lib/safe-action.ts` (`callAction`) convertit tout throw en `ActionFailure` (retry 1× optionnel, réservé aux upserts idempotents du quiz). Le moteur quiz partagé (`use-quiz-session.ts`) traite tout throw de callback comme `{ ok: false }` (rollback optimiste garanti) — défense en profondeur. Application mécanique en 3 phases : P1 étudiant (bug prod), P2 facturation/compte, P3 admin.

**Tech Stack:** Next.js 16 Server Actions, React 19, Vitest (happy-dom, fake timers, renderHook), Playwright (`context.setOffline`).

**Spec:** `docs/superpowers/specs/2026-07-12-robustesse-reseau-server-actions-design.md`

**Rappels projet :** commits conventionnels SANS attribution Claude ; `bun run test` (JAMAIS `bun test`) ; ne jamais lancer `bun dev` soi-même ; e2e via `bun run test:e2e` (jamais `bunx playwright test`).

**Doctrine (à appliquer partout, décidée au spec) :**

- Mutation à retour structuré → `callAction(() => action(x))`. `callAction` **ne throw jamais**, donc les `setBusy(false)` post-`await` s'exécutent toujours — pas besoin de try/finally supplémentaire sauf si le handler contient d'autres `await` risqués.
- Lecture (retour = données brutes) → try/catch dans la transition, ou `.catch` sur la chaîne `.then` d'un effet (sortir du skeleton).
- `{ retries: 1 }` UNIQUEMENT sur `saveExamAnswer`, `saveTrainingAnswer`, `saveExamFlag` (upserts idempotents).
- `authClient.*` ne throw pas (résout `{ error }`) → se corrige en lisant le retour, pas avec `callAction`.
- Les toasts vivent dans les callbacks des pages ; le moteur quiz reste silencieux.

---

### Task 0: Branche, docs, baseline verte

État constaté le 2026-07-12 après merge de la PR #96 : on est sur `main` à
jour, working tree propre hors les 3 docs non suivies (spec, plan, handoff
campagne précédente).

- [ ] **Step 1: Créer la branche depuis main**

```bash
git checkout main && git pull
git checkout -b fix/robustesse-reseau-server-actions
```

- [ ] **Step 2: Formater et committer spec + plan**

```bash
bunx prettier --write docs/superpowers/specs/2026-07-12-robustesse-reseau-server-actions-design.md docs/superpowers/plans/2026-07-12-robustesse-reseau-server-actions.md
git add docs/superpowers/specs/2026-07-12-robustesse-reseau-server-actions-design.md docs/superpowers/plans/2026-07-12-robustesse-reseau-server-actions.md
git commit -m "docs: spec + plan robustesse reseau des appels client de Server Actions"
```

- [ ] **Step 3: Baseline verte**

Run: `bun run check && bun run test`
Expected: PASS avant la première ligne de code.

---

## Phase 1 — Flux étudiant (bug prod)

### Task 1: Helper `callAction` (unit, RED → GREEN)

**Files:**

- Create: `tests/lib/safe-action.test.ts`
- Create: `lib/safe-action.ts`

- [ ] **Step 1: Écrire le test unitaire (rouge)**

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { NETWORK_ERROR_MESSAGE, callAction } from "@/lib/safe-action"

afterEach(() => {
  vi.useRealTimers()
})

describe("callAction", () => {
  it("laisse passer un succès inchangé", async () => {
    const fn = vi.fn().mockResolvedValue({ success: true, data: 42 })
    await expect(callAction(fn)).resolves.toEqual({ success: true, data: 42 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("laisse passer une erreur serveur inchangée, sans la retenter", async () => {
    const fn = vi
      .fn()
      .mockResolvedValue({ success: false, error: "Examen introuvable." })
    await expect(callAction(fn, { retries: 2 })).resolves.toEqual({
      success: false,
      error: "Examen introuvable.",
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("convertit un rejet réseau en ActionFailure", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(callAction(fn)).resolves.toEqual({
      success: false,
      error: NETWORK_ERROR_MESSAGE,
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("sans opts, ne retente jamais", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    await callAction(fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries: 1 → retente après 1 s et réussit", async () => {
    vi.useFakeTimers()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ success: true })
    const p = callAction(fn, { retries: 1 })
    await vi.advanceTimersByTimeAsync(1000)
    await expect(p).resolves.toEqual({ success: true })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("retries: 1 → deux échecs = ActionFailure", async () => {
    vi.useFakeTimers()
    const fn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    const p = callAction(fn, { retries: 1 })
    await vi.advanceTimersByTimeAsync(1000)
    await expect(p).resolves.toEqual({
      success: false,
      error: NETWORK_ERROR_MESSAGE,
    })
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Vérifier le rouge**

Run: `bun run test -- safe-action`
Expected: FAIL — module `@/lib/safe-action` introuvable.

- [ ] **Step 3: Implémenter le helper**

```ts
// lib/safe-action.ts
// Client-safe : aucun import serveur. Convertit les rejets réseau d'un appel
// de Server Action en échec structuré, discriminable par les gardes existants
// (`!res.success` comme `"error" in res`).

export type ActionFailure = { success: false; error: string }

export const NETWORK_ERROR_MESSAGE =
  "Connexion perdue. Vérifiez votre réseau et réessayez."

const RETRY_DELAY_MS = 1000

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// `retries` est RÉSERVÉ aux actions idempotentes (upserts) : un « Failed to
// fetch » peut survenir alors que la requête a atteint le serveur, le retry
// ré-exécute donc l'action.
export async function callAction<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number },
): Promise<T | ActionFailure> {
  const retries = opts?.retries ?? 0
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch {
      if (attempt < retries) {
        await delay(RETRY_DELAY_MS)
        continue
      }
      return { success: false, error: NETWORK_ERROR_MESSAGE }
    }
  }
}
```

- [ ] **Step 4: Vérifier le vert**

Run: `bun run test -- safe-action`
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/safe-action.ts tests/lib/safe-action.test.ts
git commit -m "feat: callAction - rejets reseau des Server Actions convertis en echec structure"
```

---

### Task 2: Durcir le moteur quiz (throw de callback = `{ ok: false }`) (RED → GREEN)

Le contrat `QuizCallbacks.onFlag` passe de `Promise<void>` à
`Promise<{ ok: boolean }>` pour permettre le rollback du flag. Les deux
fournisseurs de callbacks (`evaluation-client.tsx`,
`training-session-client.tsx`) sont ajustés a minima dans cette task pour que
`tsc` reste vert (le câblage `callAction` complet arrive en Tasks 3–4).

**Files:**

- Create: `tests/components/quiz/use-quiz-session-network.test.tsx` (même dossier que les tests existants du hook)
- Modify: `tests/components/quiz/use-quiz-session.test.ts:36,293` — mocks `onFlag: vi.fn().mockResolvedValue(undefined)` → `mockResolvedValue({ ok: true })`. Sans ça, le nouveau `.then((res) => { if (!res.ok) … })` fait un TypeError sur `undefined` → unhandled rejection → gate rouge (revue design #2 ; invisible à tsc, `vi.fn()` renvoie `any`)
- Modify: `components/quiz/runner/types.ts:44` (contrat onFlag)
- Modify: `components/quiz/runner/use-quiz-session.ts` (answerSelect l.162-198 **avec sérialisation par question** — revue #1, confirmAnswer l.209, toggleFlag l.143-158, pause l.231, resume l.239, confirmFinish l.257)
- Modify: `components/quiz/pause-dialog.tsx:46-66` (garde one-shot auto-resume — revue #3)
- Modify: `app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/_components/evaluation-client.tsx:142-144` (onFlag renvoie `{ ok }`)
- Modify: `app/(dashboard)/tableau-de-bord/entrainement/_components/training-session-client.tsx:135` (onFlag stub renvoie `{ ok: true }`)

- [ ] **Step 1: Écrire le test composant (rouge)**

```tsx
import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type {
  QuizCallbacks,
  QuizMode,
  QuizQuestion,
} from "@/components/quiz/runner/types"
import { useQuizSession } from "@/components/quiz/runner/use-quiz-session"

const QUESTIONS: QuizQuestion[] = [
  { _id: "q1", question: "Q ?", options: ["A", "B", "C"], domain: "Cardio" },
]

const DEFERRED_MODE: QuizMode = {
  kind: "exam",
  accent: "blue",
  timer: null,
  pause: null,
  feedback: "deferred",
  showMeta: false,
  labels: { title: "t", finishCta: "Terminer" },
  backUrl: "/x",
}

const networkReject = () => Promise.reject(new TypeError("Failed to fetch"))

const makeCallbacks = (over: Partial<QuizCallbacks>): QuizCallbacks => ({
  onAnswer: vi.fn(async () => ({ ok: true }) as const),
  onFlag: vi.fn(async () => ({ ok: true }) as const),
  onFinish: vi.fn(async () => ({ ok: true }) as const),
  ...over,
})

const renderSession = (
  callbacks: QuizCallbacks,
  initialPause?: { isPaused: boolean; totalPauseDurationMs: number },
) =>
  renderHook(() =>
    useQuizSession({
      questions: QUESTIONS,
      initialAnswers: {},
      initialPause,
      mode: DEFERRED_MODE,
      callbacks,
    }),
  )

describe("use-quiz-session — rejets réseau des callbacks", () => {
  it("answerSelect : rollback de l'optimiste quand onAnswer rejette", async () => {
    const callbacks = makeCallbacks({ onAnswer: vi.fn(networkReject) })
    const { result } = renderSession(callbacks)
    await act(async () => {
      await result.current.answerSelect(0)
    })
    expect(result.current.answers["q1"]).toBeUndefined()
  })

  it("sérialisation : un clic pendant un envoi en vol est coalescé, envoyé après, sans rollback", async () => {
    let rejectA!: (e: unknown) => void
    const inFlightA = new Promise<never>((_, reject) => {
      rejectA = reject
    })
    const onAnswer = vi
      .fn()
      .mockReturnValueOnce(inFlightA) // clic A : reste en vol
      .mockResolvedValueOnce({ ok: true }) // clic B : réussit
    const { result } = renderSession(makeCallbacks({ onAnswer }))
    await act(async () => {
      void result.current.answerSelect(0) // A
    })
    await act(async () => {
      void result.current.answerSelect(1) // B pendant que A est en vol
    })
    expect(onAnswer).toHaveBeenCalledTimes(1) // B coalescé, pas encore parti
    await act(async () => {
      rejectA(new TypeError("Failed to fetch"))
    })
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2))
    expect(onAnswer).toHaveBeenLastCalledWith("q1", "B")
    // L'échec de A (supersédé) ne rollback PAS l'optimiste de B
    expect(result.current.answers["q1"]?.selected).toBe("B")
  })

  it("rollback vers la dernière valeur CONFIRMÉE, pas l'état d'avant-clic", async () => {
    const onAnswer = vi
      .fn()
      .mockResolvedValueOnce({ ok: true }) // A persisté
      .mockRejectedValueOnce(new TypeError("Failed to fetch")) // B échoue
    const { result } = renderSession(makeCallbacks({ onAnswer }))
    await act(async () => {
      await result.current.answerSelect(0) // A confirmé serveur
    })
    await act(async () => {
      await result.current.answerSelect(1) // B échoue
    })
    expect(result.current.answers["q1"]?.selected).toBe("A")
  })

  it("toggleFlag : rollback du flag quand onFlag rejette", async () => {
    const callbacks = makeCallbacks({ onFlag: vi.fn(networkReject) })
    const { result } = renderSession(callbacks)
    act(() => {
      result.current.toggleFlag()
    })
    await waitFor(() => expect(result.current.flagged.has("q1")).toBe(false))
  })

  it("toggleFlag : rollback du flag quand onFlag renvoie { ok: false }", async () => {
    const callbacks = makeCallbacks({
      onFlag: vi.fn(async () => ({ ok: false }) as const),
    })
    const { result } = renderSession(callbacks)
    act(() => {
      result.current.toggleFlag()
    })
    await waitFor(() => expect(result.current.flagged.has("q1")).toBe(false))
  })

  it("confirmFinish : pas de crash quand onFinish rejette, dialog réouvrable", async () => {
    const callbacks = makeCallbacks({ onFinish: vi.fn(networkReject) })
    const { result } = renderSession(callbacks)
    await act(async () => {
      await result.current.confirmFinish()
    })
    await waitFor(() => expect(result.current.isSubmitting).toBe(false))
  })

  it("pause : pas de crash quand onPause rejette", async () => {
    const callbacks = makeCallbacks({ onPause: vi.fn(networkReject) })
    const { result } = renderSession(callbacks)
    await act(async () => {
      await result.current.pause()
    })
    expect(result.current.isPaused).toBe(false)
  })

  it("resume : pas de crash quand onResume rejette (session montée en pause)", async () => {
    // initialPause obligatoire : sinon le early-return `!isPaused` de resume()
    // fait passer le test à vide sans toucher le callback (revue design #8)
    const callbacks = makeCallbacks({ onResume: vi.fn(networkReject) })
    const { result } = renderSession(callbacks, {
      isPaused: true,
      totalPauseDurationMs: 0,
    })
    await act(async () => {
      await result.current.resume()
    })
    expect(callbacks.onResume).toHaveBeenCalledTimes(1)
    expect(result.current.isPaused).toBe(true)
  })
})
```

Note : le test « onFlag renvoie `{ ok: false }` » échouera aussi à la
compilation tant que le contrat `onFlag` n'a pas changé — c'est voulu.

- [ ] **Step 2: Vérifier le rouge**

Run: `bun run test -- use-quiz-session-network`
Expected: FAIL — rollback absents + unhandled rejections rapportées par vitest.

- [ ] **Step 3: Changer le contrat onFlag dans `components/quiz/runner/types.ts`**

```ts
// Avant (l.44)
onFlag: (questionId: string, isFlagged: boolean) => Promise<void>
// Après — { ok } permet au moteur de rollback le flag local
onFlag: (questionId: string, isFlagged: boolean) => Promise<{ ok: boolean }>
```

Ajustements minimaux des deux fournisseurs (repris proprement en Tasks 3–4) :

```ts
// evaluation-client.tsx (l.142-144)
onFlag: async (questionId, isFlagged) => {
  const res = await saveExamFlag({ examId, questionId, isFlagged })
  return { ok: res.success }
},

// training-session-client.tsx (l.135) — flags locaux, no-op serveur
onFlag: async () => ({ ok: true }),
```

- [ ] **Step 4: Durcir `use-quiz-session.ts`**

`toggleFlag` (remplace l.143-158) — le fire-and-forget sort de l'updater et
gagne un rollback :

```ts
const toggleFlag = useCallback(() => {
  if (!currentQuestion) return
  const qid = currentQuestion._id
  const newValue = !flagged.has(qid)
  setFlagged((prev) => {
    const next = new Set(prev)
    if (newValue) {
      next.add(qid)
    } else {
      next.delete(qid)
    }
    return next
  })
  const revert = () =>
    setFlagged((prev) => {
      const next = new Set(prev)
      if (newValue) {
        next.delete(qid)
      } else {
        next.add(qid)
      }
      return next
    })
  // Silencieux (pas de toast) : cosmétique, pas de bruit en passation.
  callbacks.onFlag(qid, newValue).then(
    (res) => {
      if (!res.ok) revert()
    },
    () => revert(),
  )
}, [currentQuestion, flagged, callbacks])
```

`answerSelect` (branche différée, l.179-196) — **réécrite avec sérialisation
par question** (revue design #1 : sans elle, le retry d'un clic périmé peut
écraser côté serveur un clic plus récent, en silence — les deux « réussissent »).
Deux refs au niveau du hook :

```ts
// Un seul onAnswer en vol par question ; le clic le plus récent pendant un
// envoi remplace le précédent (coalescing) et part quand l'envoi se règle.
// Le retry de callAction vit DANS ce créneau → l'ordre des clics est préservé.
const answerSends = useRef<
  Record<string, { inFlight: boolean; queued?: string }>
>({})
// Dernière valeur CONFIRMÉE par le serveur — cible du rollback (jamais
// « l'état d'avant-clic », qu'un clic intermédiaire a pu rendre périmé).
const persistedAnswers = useRef<Record<string, string | undefined>>(
  Object.fromEntries(
    Object.entries(initialAnswers).map(([qid, a]) => [qid, a.selected]),
  ),
)
```

Corps de la branche différée (remplace l'optimiste + await + rollback actuels) :

```ts
// Test / examen (feedback différé) : optimiste + envoi sérialisé.
setAnswers((a) => ({ ...a, [qid]: { ...a[qid], selected } }))

const state = (answerSends.current[qid] ??= { inFlight: false })
if (state.inFlight) {
  state.queued = selected
  return
}
state.inFlight = true
let current = selected
for (;;) {
  let res: Awaited<ReturnType<QuizCallbacks["onAnswer"]>>
  try {
    res = await callbacks.onAnswer(qid, current)
  } catch {
    res = { ok: false }
  }
  const queued = state.queued
  state.queued = undefined
  if (queued !== undefined) {
    // Supersédé par un clic plus récent : ni rollback ni validation —
    // on envoie le dernier choix. (Si l'envoi supersédé a échoué, son toast
    // est déjà parti côté page : bruit résiduel accepté, cf. spec §2.)
    current = queued
    continue
  }
  state.inFlight = false
  if (res.ok) {
    persistedAnswers.current[qid] = current
  } else {
    const persisted = persistedAnswers.current[qid]
    setAnswers((a) => {
      const next = { ...a }
      if (persisted === undefined) {
        delete next[qid]
      } else {
        next[qid] = { ...next[qid], selected: persisted }
      }
      return next
    })
  }
  return
}
```

Le `useCallback` d'`answerSelect` perd sa dépendance `answers` (le rollback
lit `persistedAnswers`, une ref) — retirer `answers` du tableau de deps.

`confirmAnswer` (l.209) :

```ts
let res: Awaited<ReturnType<QuizCallbacks["onAnswer"]>>
try {
  res = await callbacks.onAnswer(qid, selected)
} catch {
  return // pending conservé ; isConfirming libéré par le try/finally du runner
}
if (!res.ok) return
```

`pause` (l.229-235) et `resume` (l.237-246) — même forme :

```ts
const pause = useCallback(async () => {
  if (!callbacks.onPause || isPaused) return
  try {
    const res = await callbacks.onPause()
    if (res.ok) {
      setIsPaused(true)
    }
  } catch {
    // échec réseau : rester non-pausé, le callback de page a déjà toasté
  }
}, [callbacks, isPaused])
```

(`resume` : idem autour de l'`await`, corps de succès inchangé.)

`confirmFinish` (l.254-266) :

```ts
startTransition(async () => {
  try {
    await callbacks.onFinish({ isAutoSubmit: opts?.isAutoSubmit ?? false })
  } catch {
    // échec réseau : le dialog reste ouvert, retentable
  }
})
```

`pause-dialog.tsx` (l.46-66) — garde one-shot sur l'auto-resume (revue #3 :
l'`onResume()` tourne dans un `setInterval` 1 s → pause expirée + hors ligne =
un toast d'erreur par seconde) :

```ts
const autoResumeFiredRef = useRef(false)

useEffect(() => {
  if (!isOpen || !pauseStartedAt) return
  autoResumeFiredRef.current = false // nouvelle pause = nouveau one-shot

  const updatePauseTime = () => {
    // ... calcul existant inchangé
    if (isPauseExpired(pauseStartedAt, pauseDurationMinutes)) {
      if (!autoResumeFiredRef.current) {
        autoResumeFiredRef.current = true
        // En cas d'échec (réseau), pas de nouvelle tentative auto : le bouton
        // btn-resume-exam reste la voie de retentative manuelle.
        onResume()
      }
    }
  }
  // ... interval existant inchangé
}, [isOpen, pauseStartedAt, pauseDurationMinutes, onResume])
```

Enfin, mettre à jour les deux mocks du test existant
`tests/components/quiz/use-quiz-session.test.ts:36,293` :
`onFlag: vi.fn().mockResolvedValue(undefined)` → `mockResolvedValue({ ok: true })`.

- [ ] **Step 5: Vérifier le vert + non-régression**

Run: `bun run test -- use-quiz-session-network && bun run check && bun run test`
Expected: PASS partout (les tests QuizRunner/QuestionCard existants inclus).

- [ ] **Step 6: Commit**

```bash
git add components/quiz/runner/types.ts components/quiz/runner/use-quiz-session.ts components/quiz/pause-dialog.tsx "app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/_components/evaluation-client.tsx" "app/(dashboard)/tableau-de-bord/entrainement/_components/training-session-client.tsx" tests/components/quiz/
git commit -m "fix: moteur quiz - envois de reponses serialises par question + rejets de callbacks traites comme echecs"
```

---

### Task 3: `evaluation-client.tsx` — callbacks via `callAction`

**Files:**

- Modify: `app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/_components/evaluation-client.tsx:129-197`

- [ ] **Step 1: Câbler `callAction` dans les 5 callbacks**

Ajouter `import { callAction } from "@/lib/safe-action"` puis :

```ts
const callbacks: QuizCallbacks = {
  onAnswer: async (questionId, selectedAnswer) => {
    const res = await callAction(
      () => saveExamAnswer({ examId, questionId, selectedAnswer }),
      { retries: 1 }, // upsert idempotent — absorbe les micro-coupures
    )
    if (!res.success) {
      toast.error("Réponse non enregistrée, réessayez.")
      return {
        ok: false,
        error: res.error ?? "Erreur lors de l'enregistrement",
      }
    }
    return { ok: true }
  },
  onFlag: async (questionId, isFlagged) => {
    const res = await callAction(
      () => saveExamFlag({ examId, questionId, isFlagged }),
      { retries: 1 },
    )
    return { ok: res.success }
  },
  onFinish: async ({ isAutoSubmit }) => {
    const result = await callAction(() =>
      finalizeExam({ examId, isAutoSubmit }),
    )
    if (!result.success) {
      const error = result.error ?? "Erreur lors de la soumission"
      if (error.includes("déjà passé") || error.includes("plus active")) {
        router.push("/tableau-de-bord/examen-blanc")
      }
      toast.error(error)
      return { ok: false }
    }
    // ... branches de succès existantes inchangées (toasts + redirect)
  },
  onPause: exam.enablePause
    ? async () => {
        const res = await callAction(() => pauseExam({ examId }))
        if (res.success) {
          toast.info("⏸️ Pause - Prenez une pause bien méritée !", {
            duration: 5000,
          })
        } else {
          toast.error(res.error ?? "Erreur lors de la mise en pause")
        }
        return { ok: res.success }
      }
    : undefined,
  onResume: exam.enablePause
    ? async () => {
        const res = await callAction(() => resumeExam({ examId }))
        if (res.success) {
          toast.success("Pause terminée - Continuez l'examen !")
          return { ok: true, totalPauseDurationMs: res.totalPauseDurationMs }
        }
        toast.error(res.error ?? "Erreur lors de la reprise")
        return { ok: false }
      }
    : undefined,
}
```

Attention au narrowing : après `callAction`, `res` est
`RetourAction | ActionFailure` — accéder aux champs de succès
(`res.totalPauseDurationMs`, `result.startedAt`…) uniquement APRÈS le garde
`res.success`. `handleStartExam` garde son try/catch existant (déjà protégé).

- [ ] **Step 2: Vérifier**

Run: `bun run check && bun run test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/tableau-de-bord/examen-blanc/[examId]/evaluation/_components/evaluation-client.tsx"
git commit -m "fix: passation d'examen resiliente aux coupures reseau (callAction + retry sur les saves)"
```

---

### Task 4: `training-session-client.tsx` — idem

**Files:**

- Modify: `app/(dashboard)/tableau-de-bord/entrainement/_components/training-session-client.tsx:111-149`

- [ ] **Step 1: Câbler `callAction`**

```ts
onAnswer: async (questionId, selectedAnswer) => {
  const res = await callAction(
    () => saveTrainingAnswer({ sessionId, questionId, selectedAnswer }),
    { retries: 1 },
  )
  if (!res.success) {
    toast.error("Réponse non enregistrée, réessayez.")
    return { ok: false, error: res.error }
  }
  // ... construction du reveal existante inchangée
},
onFlag: async () => ({ ok: true }),
onFinish: async () => {
  const res = await callAction(() => completeTrainingSession({ sessionId }))
  if (!res.success) {
    toast.error("Erreur", { description: res.error })
    return { ok: false }
  }
  // ... succès existant inchangé (toast + redirect)
},
```

- [ ] **Step 2: Vérifier + commit**

Run: `bun run check && bun run test` — Expected: PASS.

```bash
git add "app/(dashboard)/tableau-de-bord/entrainement/_components/training-session-client.tsx"
git commit -m "fix: session d'entrainement resiliente aux coupures reseau"
```

---

### Task 5: Lectures P1 non gardées (3 sites)

**Files:**

- Modify: `app/(dashboard)/tableau-de-bord/entrainement/_components/training-config-form.tsx:63` (transition `loadAvailableObjectifsCMC`)
- Modify: `app/(dashboard)/tableau-de-bord/entrainement/_components/training-history-section.tsx:74` (transition `loadTrainingHistory`)
- Modify: `components/quiz/results/session-results.tsx:149-174` (`loadExplanations(...).then(...)` à la l.156) — composant **partagé** (résultats examen étudiant + vue admin + entraînement) : le `.catch` + toast s'applique aux trois vues (acceptable) ; `sonner` n'y est pas encore importé, ajouter l'import

- [ ] **Step 1: Garder les 3 lectures**

Transitions (config-form, history) — try/catch dans le corps async, modèle
`abonnements-client.tsx` `handleLoadMore` :

```ts
startLoadMore(async () => {
  try {
    const page = await loadTrainingHistory(/* args existants */)
    // ... setState existants
  } catch {
    toast.error("Impossible de charger l'historique. Vérifiez votre réseau.")
  }
})
```

(même forme pour `loadAvailableObjectifsCMC` ; message : « Impossible de
charger les objectifs CMC. » — pas de toast bloquant, la liste reste sur
l'état précédent.)

Chaîne d'effet (session-results) :

```ts
loadExplanations(toLoad)
  .then((data) => {
    // ... setState existants
  })
  .catch(() => {
    // re-déplier la question retente (loadedIds non marqué) — feedback léger
    toast.error("Explications indisponibles. Vérifiez votre réseau.")
  })
```

- [ ] **Step 2: Vérifier + commit**

Run: `bun run check && bun run test` — Expected: PASS.

```bash
git add "app/(dashboard)/tableau-de-bord/entrainement/_components/training-config-form.tsx" "app/(dashboard)/tableau-de-bord/entrainement/_components/training-history-section.tsx" components/quiz/results/session-results.tsx
git commit -m "fix: lectures quiz/entrainement gardees contre les rejets reseau"
```

---

### Task 6: E2E offline (le scénario prod, gardé en régression)

**Files:**

- Create: `e2e/tests/examen-blanc-offline.spec.ts`
- Modify: `playwright.config.ts` (ajouter le spec au `testMatch` du projet `chromium-auth`)

- [ ] **Step 1: Écrire le spec**

Boilerplate seed/POM : calquer sur `e2e/tests/examen-blanc.spec.ts` existant
(seed `seed-exam` dédié en `beforeAll`, ciblage `exam-card-{id}` via le POM,
`cleanup` en `afterAll`, `acceptWarningOrResume()`). La partie offline :

```ts
test("coupure réseau pendant la passation : toast + rollback, puis reprise", async ({
  page,
  context,
}) => {
  // ... démarrage examen via POM (seed dédié, acceptWarningOrResume)

  // Réponse en ligne : sanity check du câblage
  await page.getByTestId("answer-option-0").scrollIntoViewIfNeeded()
  await page.getByTestId("answer-option-0").click()
  await expect(page.getByTestId("answer-option-0")).toHaveAttribute(
    "data-selected",
    "true",
  )

  // Coupure réseau → le clic suivant échoue (retry 1× à 1 s inclus)
  await context.setOffline(true)
  await page.getByTestId("answer-option-1").click()
  await expect(
    page.getByText("Réponse non enregistrée, réessayez."),
  ).toBeVisible({ timeout: 10_000 })
  // Rollback : l'option 1 n'est PAS retenue, l'option 0 reste la réponse
  await expect(page.getByTestId("answer-option-1")).not.toHaveAttribute(
    "data-selected",
    "true",
  )

  // Retour en ligne → le re-clic persiste
  await context.setOffline(false)
  await page.getByTestId("answer-option-1").click()
  await expect(page.getByTestId("answer-option-1")).toHaveAttribute(
    "data-selected",
    "true",
  )
})
```

- [ ] **Step 2: Lancer le spec seul**

Run: `bun run test:e2e e2e/tests/examen-blanc-offline.spec.ts --reporter=list`
Expected: PASS (run ciblé, pas la suite complète).

- [ ] **Step 3: Commit — clôture Phase 1**

```bash
git add e2e/tests/examen-blanc-offline.spec.ts playwright.config.ts
git commit -m "test(e2e): passation d'examen sous coupure reseau (setOffline)"
```

---

## Phase 2 — Facturation / compte

### Task 7: `createCustomerPortal` (le 🔴 facturation)

**Files:**

- Modify: `app/(dashboard)/tableau-de-bord/abonnements/_components/abonnements-client.tsx:263`

- [ ] **Step 1: Envelopper avec `callAction`**

```ts
const [, openPortalAction, isLoadingPortal] = useActionState(
  async () => {
    const res = await callAction(() =>
      createCustomerPortal("/tableau-de-bord/abonnements"),
    )
    if ("error" in res) {
      // branches existantes inchangées : navigator.onLine (désormais
      // atteignable), « Aucun historique », toast générique
      ...
      return { success: false }
    }
    window.location.href = res.portalUrl
    return { success: true }
  },
  { success: false },
)
```

`ActionFailure` porte `error` → le garde `"error" in res` existant l'attrape ;
plus aucun throw ne remonte à l'error boundary React 19.

- [ ] **Step 2: Vérifier + commit**

Run: `bun run check && bun run test` — Expected: PASS.

```bash
git add "app/(dashboard)/tableau-de-bord/abonnements/_components/abonnements-client.tsx"
git commit -m "fix: portail de facturation Stripe resilient aux coupures reseau (plus d'error boundary)"
```

---

### Task 8: Profil (5 fichiers)

**Files:**

- Modify: `app/(dashboard)/tableau-de-bord/profil/_components/profile-notifications.tsx:22`
- Modify: `app/(dashboard)/tableau-de-bord/profil/_components/profile-sessions.tsx:23,35`
- Modify: `app/(dashboard)/tableau-de-bord/profil/_components/profile-password.tsx:47`
- Modify: `app/(dashboard)/tableau-de-bord/profil/_components/profile-danger-zone.tsx:23,29`

- [ ] **Step 1: `profile-notifications.tsx` — l'exemplaire complet**

```ts
const update = async (next: NotificationPreferences) => {
  const prev = prefs
  setPrefs(next) // optimistic
  setBusy(true)
  const res = await callAction(() => updateNotificationPreferences(next))
  setBusy(false) // toujours atteint : callAction ne throw jamais
  if (!res.success) {
    setPrefs(prev) // rollback
    toast.error(res.error ?? "Échec de la mise à jour")
    return
  }
  toast.success("Préférences mises à jour")
}
```

- [ ] **Step 2: Les 3 autres fichiers — même transformation**

Pour chaque site, remplacer l'`await action(...)` nu par
`await callAction(() => action(...))` sans toucher au flux : les
`setBusy(false)` post-`await` redeviennent sûrs. Ajouter
`toast.error(res.error ?? "...")` là où la branche `!res.success` n'existe
pas encore.

⚠️ Revue design #6 : `profile-sessions` et `profile-password` **toastent
déjà** leur branche `!res.success` (`profile-sessions.tsx:25-27,37-39`,
`profile-password.tsx:48-50`) — le seul trou est le rejet fetch. Ne PAS
dupliquer ni remplacer les toasts existants : le wrap `callAction` suffit
(son `ActionFailure.error` alimente le toast déjà en place).

- `profile-sessions.tsx:23` (`revokeUserSession(id)`) et `:35`
  (`revokeOtherUserSessions()`) : wrap `callAction`, rien d'autre.
- `profile-password.tsx:47` (`setAccountPassword`) : wrap `callAction`,
  gestion RHF et toast existants conservés.
- `profile-danger-zone.tsx:23` (`deleteMyAccount`) : wrap `callAction` +
  toast sur `!res.success` (à vérifier sur place).
- `profile-danger-zone.tsx:29` (`authClient.signOut()`) : PAS de `callAction`
  (authClient ne throw pas) — sécuriser sans changer le flux, et surtout
  **conserver la destination `/compte-supprime`** (page qui explique la
  fenêtre de réactivation 30 j — revue design #4) :

```ts
await authClient.signOut().catch(() => {})
router.replace("/compte-supprime")
```

- [ ] **Step 3: Vérifier + commit**

Run: `bun run check && bun run test` — Expected: PASS.

```bash
git add "app/(dashboard)/tableau-de-bord/profil/_components/"
git commit -m "fix: ecrans profil resilients aux coupures reseau (busy libere, rollback notifications)"
```

---

### Task 9: `useMarketingStats` (skeleton marketing infini)

La campagne marketing #84/#85 (`resolveSuccessRate`) est mergée (PR #96) —
adapter les edits au code courant du hook et de son test (les numéros de
ligne de l'audit datent d'avant le merge).

**Files:**

- Modify: `hooks/useMarketingStats.ts:15`
- Modify: `tests/hooks/useMarketingStats.test.tsx` (cas d'échec)

- [ ] **Step 1: Garder la chaîne du hook**

⚠️ Revue design #5 : ne PAS chercher `MARKETING_CLAIMS` ni `resolveSuccessRate`
— ces symboles n'existent pas dans l'arbre (la bascule #85 mergée vit côté
serveur dans `features/marketing/dal.ts:56`, et les fallbacks client sont des
`??` inline chez les 7 consommateurs : `home-landing.tsx:162,307`,
`about-story.tsx:33`, `domains-grid.tsx:21-22`, etc.). Aucune centralisation
à créer (YAGNI) : le mécanisme existant absorbe déjà `stats` absent.

Dans le hook : ajouter le `.catch` en **conservant le garde `active` du
cleanup** (`hooks/useMarketingStats.ts:14-20`, revue #10) et élargir
explicitement le type d'état :

```ts
const [stats, setStats] = useState<MarketingStats | null | undefined>(undefined)

useEffect(() => {
  let active = true
  loadMarketingStats()
    .then((s) => {
      if (active) setStats(s)
    })
    .catch(() => {
      if (active) setStats(null) // sortie du skeleton, fallbacks inline `??`
    })
  return () => {
    active = false
  }
}, [])
```

(Adapter à la forme exacte du hook courant — `isLoading` doit devenir `false`
quand `stats === null`. Les 7 consommateurs ont été vérifiés en revue : tous
en `stats?.x ?? fallback` ou gardés par `if (isLoading)` — aucun crash ni
skeleton résiduel sur `null`.)

- [ ] **Step 2: Ajouter le cas d'échec au test du hook**

```tsx
it("bascule hors du skeleton quand le chargement échoue", async () => {
  vi.mocked(loadMarketingStats).mockRejectedValueOnce(
    new TypeError("Failed to fetch"),
  )
  const { result } = renderHook(() => useMarketingStats())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
})
```

(Adapter le nom du mock à la structure existante du fichier de test.)

- [ ] **Step 3: Vérifier + commit**

Run: `bun run check && bun run test` — Expected: PASS.

```bash
git add hooks/useMarketingStats.ts tests/hooks/useMarketingStats.test.tsx
git commit -m "fix: stats marketing - echec de chargement sans skeleton infini (fallback editorial)"
```

---

## Phase 3 — Admin

### Task 10: Les 4 modales verrouillables 🔴

**Files:**

- Modify: `app/(admin)/admin/examens/[id]/_components/exam-leaderboard.tsx:73` (`deleteParticipation`)
- Modify: `components/admin/exams-list.tsx:81` (`deactivateExam`) et `:119` (`deleteExam`)
- Modify: `app/(admin)/admin/questions/_components/question-side-panel.tsx:122` (`deleteQuestion`)

- [ ] **Step 1: Transformation identique aux 4 sites**

Modèle (exam-leaderboard ; les 3 autres sont isomorphes) :

```ts
setIsDeleting(true)
const res = await callAction(() => deleteParticipation({/* args existants */}))
setIsDeleting(false) // toujours atteint désormais
if (!res.success) {
  // Conserver le toast existant si la branche en a déjà un ; sinon :
  toast.error(res.error ?? "Échec de la suppression. Vérifiez votre réseau.")
  return
}
// ... succès existant inchangé (toast + refresh/fermeture)
```

Vérifier après coup : plus aucun `disabled={isDeleting}` ne peut rester
figé (le state est libéré sur tous les chemins).

- [ ] **Step 2: Vérifier + commit**

Run: `bun run check && bun run test` — Expected: PASS.

```bash
git add "app/(admin)/admin/examens/[id]/_components/exam-leaderboard.tsx" components/admin/exams-list.tsx "app/(admin)/admin/questions/_components/question-side-panel.tsx"
git commit -m "fix(admin): modales de suppression/desactivation liberees apres un echec reseau"
```

---

### Task 11: Mutations admin dont seul le rejet fetch est non géré

⚠️ Revue design #6 : les branches `!success` de ces deux sites **toastent
déjà** (`user-role-section.tsx:53`, `exams-list.tsx:99`) — ne pas dupliquer.
Le travail se réduit au wrap `callAction`. Enjeu réel de `user-role-section` :
l'`await` nu est DANS une transition (l.39) → un rejet fetch y remonte à
l'**error boundary** au rendu (même mécanique que le cas Sentry
`finalizeExam`), pas seulement en unhandled rejection.

**Files:**

- Modify: `app/(admin)/admin/utilisateurs/[id]/_components/user-role-section.tsx:40` (`updateUserRole`)
- Modify: `components/admin/exams-list.tsx:94` (`reactivateExam`)

- [ ] **Step 1: Wrap `callAction`, toasts existants conservés**

```ts
const res = await callAction(() => updateUserRole({/* args existants */}))
// ... branches existantes inchangées : le toast `!res.success` en place
// affiche désormais aussi NETWORK_ERROR_MESSAGE sur un rejet fetch
```

- [ ] **Step 2: Vérifier + commit**

Run: `bun run check && bun run test` — Expected: PASS.

```bash
git add "app/(admin)/admin/utilisateurs/[id]/_components/user-role-section.tsx" components/admin/exams-list.tsx
git commit -m "fix(admin): toast d'echec sur updateUserRole et reactivateExam"
```

---

### Task 12: Lectures admin `.then` sans `.catch` (9 sites, skeletons morts)

**Files (tous en Modify) :**

- `app/(admin)/admin/utilisateurs/_components/user-side-panel.tsx:246,253`
- `app/(admin)/admin/questions/_components/question-form-page.tsx:140`
- `app/(admin)/admin/questions/_components/question-side-panel.tsx:107`
- `app/(admin)/admin/questions/_components/objectif-cmc-combobox.tsx:43`
- `components/admin/question-browser/question-browser-context.tsx:139`
- `components/admin/question-browser/question-preview-panel.tsx:72`
- `app/(admin)/admin/examens/[id]/_components/exam-questions-modal.tsx:51`
- `components/shared/payments/edit-transaction-modal.tsx:121`
- `components/shared/payments/delete-transaction-dialog.tsx:44`

- [ ] **Step 1: Ajouter un `.catch` qui sort du skeleton**

Modèle (question-side-panel ; adapter le setState d'échec à chaque écran) :

```ts
loadQuestionById(questionId)
  .then((q) => setQuestion(q))
  .catch(() => {
    toast.error("Chargement impossible. Vérifiez votre réseau.")
    // sortir de l'état de chargement : fermer le panel/dialog OU afficher
    // un message inline — selon ce que l'écran permet déjà proprement
  })
```

Cas particuliers :

- `question-browser-context.tsx:139` : la lecture est dans une transition →
  try/catch dans le corps async (modèle Task 5) + marquer `hasLoaded` pour
  sortir du skeleton initial.
- `edit-transaction-modal.tsx:121` / `delete-transaction-dialog.tsx:44`
  (`loadTransactionAccessImpact`) : l'avertissement de révocation est
  best-effort → `.catch` silencieux avec un état « impact inconnu » affiché
  (ne pas bloquer la modale).
- `exam-questions-modal.tsx:51` : le dialog s'ouvre avant l'`await` → sur
  échec, toast + `setIsDetailsOpen(false)`.

- [ ] **Step 2: Vérifier + commit**

Run: `bun run check && bun run test` — Expected: PASS.

```bash
git add "app/(admin)/" components/admin/ components/shared/payments/
git commit -m "fix(admin): les chargements .then sans .catch ne laissent plus de skeleton infini"
```

---

### Task 13: Reloads admin en transition (listes stale silencieuses)

**Files:**

- Modify: `app/(admin)/admin/utilisateurs/_components/users-manager.tsx:107,125`
- Modify: `app/(admin)/admin/utilisateurs/[id]/user-detail-client.tsx:66,75`
- Modify: `app/(admin)/admin/transactions/_components/transactions-manager.tsx:74,103,116`

- [ ] **Step 1: try/catch + toast dans chaque corps de transition**

Modèle (users-manager ; les 7 sites sont isomorphes) :

```ts
startTransition(async () => {
  try {
    const page = await loadUsersPage(/* args existants */)
    // ... setState existants
  } catch {
    toast.error("Actualisation impossible. Vérifiez votre réseau.")
  }
})
```

(Les `Promise.all(...)` de `user-detail-client.tsx:75` et
`transactions-manager.tsx:116` s'enveloppent d'un seul try/catch.)

- [ ] **Step 2: Vérifier + commit**

Run: `bun run check && bun run test` — Expected: PASS.

```bash
git add "app/(admin)/admin/utilisateurs/" "app/(admin)/admin/transactions/"
git commit -m "fix(admin): toasts d'echec sur les rechargements de listes (users/transactions)"
```

---

### Task 14: Règle projet + gates finaux

**Files:**

- Modify: `.claude/rules/data-layer.md` (section « Écrans »)

- [ ] **Step 1: Documenter la règle**

Ajouter à la section « Écrans (Server Component + wrapper client) » :

```md
- **Appels client de Server Actions — jamais d'`await` nu** : un rejet réseau
  (« Failed to fetch ») contourne le garde `if (!res.success)` → unhandled
  rejection, spinner figé, optimiste non rollback (post-mortem Sentry
  NOMAQBANQ-1A, 2026-07-12). Mutations : `callAction(() => action(x))`
  (`lib/safe-action.ts`) — ne throw jamais, convertit le rejet en
  `{ success: false, error }` ; `{ retries: n }` RÉSERVÉ aux actions
  idempotentes (upserts quiz). Lectures : try/catch dans la transition, ou
  `.catch` sur toute chaîne `.then` d'effet (toujours sortir du skeleton).
  Le moteur quiz traite tout throw de callback comme `{ ok: false }`
  (rollback) ; les toasts vivent dans les callbacks des pages.
```

- [ ] **Step 2: Gates finaux**

Run: `bun run check && bun run test && bun run test:e2e e2e/tests/examen-blanc-offline.spec.ts --reporter=list`
Expected: PASS partout ; coverage ≥ 75 %.

- [ ] **Step 3: Commit + rappels de fin de campagne**

```bash
git add .claude/rules/data-layer.md
git commit -m "docs: regle data-layer - jamais d'await nu de Server Action cote client"
```

Rappels post-merge (à faire par l'utilisateur, pas par le plan) :

1. Résoudre l'issue Sentry NOMAQBANQ-1A après déploiement (elle ne recevra
   plus d'événements — c'est voulu).
2. Restaurer le stash `wip-marketing-84-85` sur sa branche si Task 0 l'a créé.
3. Validation manuelle recommandée : DevTools → Network → Offline pendant une
   passation réelle (`/e2e-scenario`).
