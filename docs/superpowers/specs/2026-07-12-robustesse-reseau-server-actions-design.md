# Spec — Robustesse réseau des appels client de Server Actions

**Date** : 2026-07-12
**Statut** : validé (brainstorming) ; revue adversariale design du 2026-07-12
triée — architecture confirmée (~40 ancres vérifiées, invariants tenus), 4
correctifs bloquants intégrés : sérialisation des envois de réponses par
question (course retry/clic périmé), test existant du hook ajouté au périmètre
(mocks `onFlag`), redirect `/compte-supprime` conservé, Task 9 réécrite sans
symboles fantômes ; + garde one-shot auto-resume, prémisses « sans toast »
corrigées, chemin `session-results` fixé
**Origine** : Sentry NOMAQBANQ-1A (`TypeError: Failed to fetch`, prod 2026-07-12,
page `/tableau-de-bord/examen-blanc/:examId/evaluation`)

## Contexte

Toutes les Server Actions du projet renvoient `{ success: false, error }` en
cas d'erreur serveur, et les clients testent `if (!res.success)`. Mais quand le
**fetch POST lui-même** rejette (connexion coupée — audience fréquemment sur
réseaux mobiles instables), l'`await action()` côté client **throw** et cette
branche n'est jamais atteinte. Les boundaries `error.tsx` (présentes à tous les
niveaux) ne couvrent pas les rejections dans les event handlers async.

Un audit exhaustif (~45 fichiers clients appelant des Server Actions) a relevé
**~27 sites non protégés**, en trois familles de symptômes :

1. **Perte silencieuse** : update optimiste posé avant l'`await`, rollback
   confiné à la branche `!res.ok` → un throw le saute. Cas le plus grave :
   `saveExamAnswer`/`saveTrainingAnswer` (la réponse reste affichée
   sélectionnée mais n'est jamais persistée, zéro feedback).
2. **UI verrouillée** : `setBusy(true)` → `await` → `setBusy(false)` sans
   try/finally → le reset est sauté, spinner et bouton Annuler
   (`disabled={busy}`) figés jusqu'au reload (4 modales admin).
3. **Unhandled rejection silencieuse** : l'événement Sentry de prod
   (`finalizeExam` dans une transition), plus une douzaine de lectures
   `.then()` sans `.catch` (skeletons infinis).

L'événement prod exact : étudiant au Cameroun, ~25 min de passation, POST de
Server Action réussis en série, puis un POST échoue à 18 h 27 → unhandled
rejection, aucune retentative, aucun toast.

## Portée

Trois couches, appliquées en trois phases (une campagne, commits séparés) :

1. **Helper commun `lib/safe-action.ts`** : convertit les rejets réseau en
   `{ success: false, error }` — la forme que tous les call sites savent déjà
   gérer. Retry optionnel (1×) pour les actions idempotentes.
2. **Durcissement du moteur quiz partagé** (`use-quiz-session.ts`,
   `quiz-runner.tsx`, `pause-dialog.tsx`) : tout throw d'un callback est
   traité comme `{ ok: false }` (rollback optimiste inclus), fire-and-forget
   avec `.catch`.
3. **Application mécanique aux sites audités** : P1 étudiant → P2
   facturation/compte → P3 admin (inventaire complet en annexe).

**Hors scope (YAGNI, réévaluer si récidive)** : bannière offline
(`navigator.onLine` + events), queue de retry persistante (localStorage),
télémétrie Sentry des échecs réseau gérés (événement attendu ; conséquence
assumée : NOMAQBANQ-1A à résoudre manuellement après déploiement),
généralisation aux lectures RSC côté serveur (autre canal, autre sémantique d'erreur).

## 1. Helper `lib/safe-action.ts`

Module client-safe (aucun import serveur), ~30 lignes :

```ts
export type ActionFailure = { success: false; error: string }

export const NETWORK_ERROR_MESSAGE =
  "Connexion perdue. Vérifiez votre réseau et réessayez."

export async function callAction<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number }, // défaut 0 — RÉSERVÉ aux actions idempotentes
): Promise<T | ActionFailure>
```

Le générique est volontairement non contraint : le repo a deux conventions de
retour (`{ success, error? }` majoritaire, et `{ error } | { payload }` pour
`createCustomerPortal`). `ActionFailure` porte à la fois `success: false` et
`error`, donc il est discriminable par les deux gardes existants
(`!res.success` comme `"error" in res`).

- `try { return await fn() } catch { … }` : tout rejet (réseau, abort) devient
  `{ success: false, error: NETWORK_ERROR_MESSAGE }`. Les erreurs **serveur**
  (`{ success: false, error }` renvoyées par l'action) passent inchangées —
  `callAction` ne les retente jamais.
- **Retry** : sur throw uniquement, au plus `opts.retries` retentatives après
  un délai fixe de 1 000 ms. Un « Failed to fetch » peut survenir alors que la
  requête a **atteint** le serveur (réponse perdue) → le retry ré-exécute
  l'action. Il est donc réservé à la liste fermée des actions idempotentes :
  `saveExamAnswer`, `saveTrainingAnswer`, `saveExamFlag` (upserts par clé
  `(participation, question)`).
- **Invariant à maintenir** : aucune Server Action du projet n'appelle
  `redirect()` côté serveur (elles renvoient des valeurs ; la navigation est
  faite au client via `router.push`). `callAction` n'a donc pas de cas spécial
  `NEXT_REDIRECT`. Si une action redirigeante apparaît un jour, ne pas
  l'envelopper.
- Pas de capture Sentry ni de log : le toast est le feedback ; ce qui reste
  non géré continue de remonter à Sentry (c'est le but).
- `authClient.*` (Better Auth / @better-fetch) **ne throw pas** sur échec
  réseau — il résout `{ error }`. Les sites authClient se corrigent en lisant
  le retour, pas avec `callAction`.

## 2. Durcissement du moteur quiz partagé

Défense en profondeur : même si un futur écran oublie `callAction` dans ses
callbacks, le moteur ne doit ni crasher ni corrompre son état. Règle de
responsabilité : **le toast vit dans les callbacks des pages** (via
`callAction`, dont le message alimente les branches `!res.success`
existantes) ; **le moteur traite tout throw comme un échec silencieux**
(`{ ok: false }`) et garantit ses invariants d'état.

Dans `components/quiz/runner/use-quiz-session.ts` :

- `answerSelect` (l.184) : try/catch autour de `callbacks.onAnswer` (un throw
  vaut `{ ok: false }`) **et envoi sérialisé par question** (revue design #1) :
  un seul `onAnswer` en vol par `questionId` ; un clic pendant l'envoi devient
  « le dernier choix en attente » (coalescing) et part quand l'envoi courant
  se règle — le retry de `callAction` vit DANS ce créneau, il ne peut donc
  plus ré-appliquer un clic périmé par-dessus un clic plus récent. Le rollback
  vise la **dernière valeur confirmée serveur** (ref `persistedAnswers`), pas
  l'état d'avant-clic, et n'a jamais lieu si un clic plus récent a pris la
  main. Bruit résiduel accepté : si un envoi supersédé échoue, son toast
  (« Réponse non enregistrée ») part alors que le clic suivant peut réussir —
  fenêtre sub-seconde, auto-corrigé visuellement.
- `confirmAnswer` (l.209) : catch → return (le pending est conservé, l'état
  `isConfirming` est déjà libéré par le try/finally du runner).
- `confirmFinish` (l.257) : try/catch dans la transition (le cas Sentry) ; en
  échec, le dialog reste ouvert pour retenter.
- `pause`/`resume` (l.231/239) : try/catch → no-op en échec (l'état
  `isPaused` n'est modifié qu'en succès, déjà le cas).
- `toggleFlag` (l.155) : le contrat `QuizCallbacks.onFlag` passe de
  `Promise<void>` à `Promise<{ ok: boolean }>` ; le moteur rollback le flag
  local si `!ok` ou throw. Silencieux (pas de toast — cosmétique, pas de bruit
  en passation).

Aucun changement dans `quiz-runner.tsx` (fire-and-forget de pause, l.115 —
sûr une fois `pause()` non-rejetante). Dans `pause-dialog.tsx` : **garde
one-shot sur l'auto-resume** (revue design #3) — l'auto-`onResume()` tourne
dans un `setInterval` 1 s, donc pause expirée + hors ligne = un toast d'erreur
par seconde ; ne déclencher l'auto-resume qu'une fois par expiration, le
bouton `btn-resume-exam` reste la voie de retentative manuelle.

## 3. Application aux écrans — inventaire par phase

Pattern par type de site :

- **Mutation avec callback structuré** : `await callAction(() => action(x))`
  (+ `{ retries: 1 }` pour les 3 saves quiz) — les branches toast existantes
  gèrent le message.
- **Mutation avec état busy** : `callAction` suffit — comme il ne throw
  jamais, le `setBusy(false)` post-`await` s'exécute toujours ; ajouter le
  toast sur `!res.success` s'il manque. (Un try/finally reste pertinent
  seulement si le handler contient d'autres `await` susceptibles de throw —
  modèle existant : `delete-transaction-dialog.tsx`.)
- **Lecture `.then(setState)` en useEffect** : ajouter `.catch` → sortir du
  skeleton (état d'erreur léger ou toast) ; le détail par écran est fixé au
  plan.
- **Lecture dans `startTransition`** : try/catch + toast (modèle existant :
  `abonnements-client.tsx` `handleLoadMore`).

### Phase 1 — Étudiant (bug prod)

| Site                                                                                                                       | Action                                                           | Traitement                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `evaluation-client.tsx` onAnswer                                                                                           | `saveExamAnswer`                                                 | `callAction` + `retries: 1`                                                 |
| `evaluation-client.tsx` onFlag                                                                                             | `saveExamFlag`                                                   | `callAction` + `retries: 1`, renvoie `{ ok }`                               |
| `evaluation-client.tsx` onFinish                                                                                           | `finalizeExam`                                                   | `callAction` (pas de retry ; re-tentable manuellement, gère « déjà passé ») |
| `evaluation-client.tsx` onPause/onResume                                                                                   | `pauseExam`/`resumeExam`                                         | `callAction`                                                                |
| `training-session-client.tsx` onAnswer/onFinish                                                                            | `saveTrainingAnswer` (+`retries: 1`) / `completeTrainingSession` | `callAction`                                                                |
| `training-config-form.tsx:63`                                                                                              | `loadAvailableObjectifsCMC`                                      | try/catch dans la transition                                                |
| `training-history-section.tsx:74`                                                                                          | `loadTrainingHistory`                                            | try/catch + toast                                                           |
| `components/quiz/results/session-results.tsx:156` (composant **partagé** : résultats examen étudiant, admin, entraînement) | `loadExamQuestionExplanations`                                   | `.catch` + toast (re-déplier retente déjà ; importer `sonner`)              |
| Moteur quiz (couche 2)                                                                                                     | —                                                                | cf. §2                                                                      |

### Phase 2 — Facturation / compte

| Site                            | Action                          | Traitement                                                                                                                                                                                    |
| ------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `abonnements-client.tsx:263` 🔴 | `createCustomerPortal`          | `callAction` dans l'action `useActionState` → la branche `navigator.onLine` existante (aujourd'hui inatteignable) fonctionne                                                                  |
| `profile-sessions.tsx:23/35`    | `revokeUserSession(s)`          | try/catch/finally (libère `busy`) + toast                                                                                                                                                     |
| `profile-notifications.tsx:22`  | `updateNotificationPreferences` | try/catch/finally + **rollback** de l'optimiste + toast                                                                                                                                       |
| `profile-password.tsx:47`       | `setAccountPassword`            | try/catch + toast (RHF libère déjà `isSubmitting`)                                                                                                                                            |
| `profile-danger-zone.tsx:23`    | `deleteMyAccount`               | try/catch/finally + toast                                                                                                                                                                     |
| `profile-danger-zone.tsx:29`    | `authClient.signOut()`          | lire `{ error }` ; rediriger quand même (le compte est supprimé côté serveur), sans unhandled                                                                                                 |
| `hooks/useMarketingStats.ts:15` | `loadMarketingStats`            | `.catch(() => setStats(null))` → sortie du skeleton ; les 7 consommateurs ont déjà leurs fallbacks inline (`stats?.x ?? "…"`) — vérifié en revue, aucun crash ni skeleton résiduel sur `null` |

### Phase 3 — Admin

| Famille                                                                                     | Sites                                                                                                                                                                                                                                                                                                | Traitement                                                                   |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 🔴 Modales verrouillables (`setBusy` sans finally)                                          | `exam-leaderboard.tsx:73` (`deleteParticipation`), `exams-list.tsx:81/:119` (`deactivateExam`/`deleteExam`), `question-side-panel.tsx:122` (`deleteQuestion`)                                                                                                                                        | try/catch/**finally** + toast                                                |
| Mutations dont seul le **rejet fetch** est non géré (les branches `!success` toastent déjà) | `user-role-section.tsx:40` (`updateUserRole` — l'`await` nu est DANS une transition : un rejet remonte à l'error boundary, même mécanique que le cas Sentry), `exams-list.tsx:94` (`reactivateExam`)                                                                                                 | wrap `callAction`, toasts existants conservés                                |
| Lectures `.then` sans `.catch` (skeleton/dialog mort)                                       | `user-side-panel.tsx:246/253`, `question-form-page.tsx:140`, `question-side-panel.tsx:107`, `objectif-cmc-combobox.tsx:43`, `question-browser-context.tsx:139`, `question-preview-panel.tsx:72`, `exam-questions-modal.tsx:51`, `edit-transaction-modal.tsx:121`, `delete-transaction-dialog.tsx:44` | `.catch` → sortir du skeleton (toast + fermeture ou message d'erreur inline) |
| Reloads en transition (liste stale)                                                         | `users-manager.tsx:107/125`, `user-detail-client.tsx:66/75`, `transactions-manager.tsx:74/103/116`                                                                                                                                                                                                   | try/catch + toast                                                            |

Sites vérifiés **déjà protégés** (aucun changement) : `startExam`, quiz public
(`loadRandomQuizQuestions`/`scoreQuizAnswers`), `pricing-grid`,
`payment-success-client`, `bienvenue`, dialogs de suppression d'entraînement,
uploaders S3 (avatar + images question), `manual-payment-modal`,
`edit/delete-transaction` (mutations), `export-questions-button`,
`user-multi-select`, `exam-create-form`, `exam-edit-form`,
`question-form-page` (submit), `authClient.changePassword`.

## 4. Documentation de la règle

Ajout à `.claude/rules/data-layer.md` (section Écrans) : jamais d'`await` nu
d'une Server Action côté client — `callAction` pour les mutations à retour
structuré, try/finally pour les états busy, `.catch` sur tout fire-and-forget
et toute chaîne `.then` d'effet. Référencer `lib/safe-action.ts`.

## 5. Tests

- **Unit `tests/lib/safe-action.test.ts`** (vitest, fake timers) : succès
  passthrough ; erreur serveur passthrough sans retry ; throw →
  `ActionFailure` ; `retries: 1` → 2 tentatives puis échec ; retry qui réussit
  à la 2ᵉ ; défaut sans retry.
- **Composant `tests/components/quiz/use-quiz-session-network.test.tsx`**
  (renderHook, même dossier que les tests existants du hook) : `onAnswer` qui
  throw → rollback de l'optimiste, pas d'unhandled rejection ; sérialisation —
  un clic pendant un envoi en vol est coalescé et envoyé après, sans rollback
  du clic récent ; échec du dernier envoi → rollback vers la dernière valeur
  **confirmée**, pas l'état d'avant-clic ; `onFlag` qui throw ou renvoie
  `{ ok: false }` → rollback du flag ; `confirmFinish` qui throw → pas de
  crash ; `onResume` qui throw testé avec `initialPause: { isPaused: true }`
  (sinon le early-return `!isPaused` fait passer le test à vide). Les mocks
  `onFlag` du test existant (`use-quiz-session.test.ts:36,293`) passent à
  `{ ok: true }` (contrat changé).
- **E2E `e2e/tests/examen-blanc-offline.spec.ts`** (projet `chromium-auth`,
  seed-exam dédié) : passation → `context.setOffline(true)` → clic réponse →
  toast visible + option désélectionnée (rollback, `data-selected` absent) →
  `setOffline(false)` → re-clic → `data-selected="true"`. Note : le retry 1×
  (1 s) impose d'attendre l'échec définitif avant d'asserter le toast.
- **Gates** : `bun run check`, `bun run test` (+ seuil coverage), e2e ciblé.

## 6. Risques et limites

- **Retry = ré-exécution potentielle** d'une action déjà appliquée (réponse
  perdue en vol) : sans danger uniquement parce que la liste est fermée aux
  upserts idempotents ET que les envois de réponses sont sérialisés par
  question (§2) — l'idempotence unitaire ne protège pas de l'ordonnancement
  entre clics successifs. Toute extension de la liste exige la même analyse.
- **Perte de visibilité Sentry** sur les coupures réseau (assumé) : si un
  écran régresse, l'unhandled rejection réapparaîtra — c'est le signal voulu.
- **`useActionState` (React 19)** : un throw dans l'action remonte à l'error
  boundary au rendu — c'est pourquoi `createCustomerPortal` est le seul site
  classé « error boundary possible » ; le fix le neutralise à la source.
- Le moteur quiz reste silencieux sur throw (pas de toast) si le callback de
  page n'utilise pas `callAction` — mitigé par la règle documentée (§4).

## 7. Critères d'acceptation

1. Rejouer le scénario prod (DevTools offline pendant une passation, clic
   réponse) : aucun événement `onunhandledrejection`, toast affiché, option
   visuellement désélectionnée, re-clic après reconnexion persiste la réponse.
2. Les 4 modales admin 🔴 se libèrent (bouton Annuler cliquable) après un
   échec réseau.
3. `createCustomerPortal` hors ligne → toast « Pas de connexion internet… »,
   pas d'error boundary.
4. Aucun `await` nu de Server Action dans les fichiers listés à l'inventaire ;
   `bun run check` et la suite de tests passent.
