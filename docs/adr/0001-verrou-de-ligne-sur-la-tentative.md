---
status: accepted
date: 2026-09-18
---

# Toute écriture sur une tentative prend un verrou de ligne ; le cron est le seul écrivain de la clôture par expiration

Une tentative (participation ou session d'entraînement, `CONTEXT.md`) recevait
ses écritures selon deux disciplines : `FOR UPDATE` côté examens, UPDATE gardé
sur le statut côté entraînement, avec trois flips d'expiration inline qui ne
scoraient pas alors que le cron score. Nous décidons que toute écriture passe
par `requireAttempt` (`features/attempts/guard.ts`), qui prend un
`SELECT … FOR UPDATE` sur la ligne de la tentative dans la transaction de
l'appelant, et que l'expiration n'est écrite que par l'écrivain scoré du cron
(`expireTrainingSessions`, `closeExpiredExamParticipations`) : une action qui
constate l'expiration refuse sans écrire.

## Options écartées

- **UPDATE gardé sur le statut (`WHERE status = 'in_progress'`) partout.** Suffit
  contre deux clôtures concurrentes, pas contre une lecture-puis-écriture
  (budget de temps, crédit de pause) : sous READ COMMITTED, deux transactions
  lisent le même état et écrivent toutes deux. Un `EXISTS` dans le WHERE ne se
  met pas en file derrière un `FOR UPDATE` détenu.
- **Fermer l'expiration au premier arrivé (action ou cron).** Deux issues pour
  un même état : l'action posait `abandoned` sans score ni `completedAt`, le
  cron avec ; l'historique de l'étudiant dépendait de qui passait en premier.

## Conséquences

- Le verrou ne porte que la tentative (`FOR UPDATE OF p`), jamais la ligne
  `exams` : la verrouiller sérialiserait les réponses de tous les candidats.
- Une session d'entraînement expirée reste `in_progress` jusqu'au passage du
  cron (ou jusqu'à ce que l'étudiant en crée une autre, qui la clôt par le même
  écrivain) : les lectures dérivent l'expiration de `expiresAt`, jamais du
  statut.
- Ce que la garde doit lire (accès payant) se lit par l'exécuteur de la
  transaction (`hasActiveAccess(tx, …)`), jamais par le `db` global.
