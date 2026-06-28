# Choix d'audience à la création d'un examen blanc

**Date** : 2026-06-28
**Statut** : design validé, prêt pour le plan d'implémentation
**Auteur** : brainstorming Samuel + Claude

## Contexte

Aujourd'hui, **tout examen actif est ouvert à tous les utilisateurs ayant un
abonnement `exam` actif**. Il n'existe aucune notion d'audience par examen :

- La liste étudiant ([`getExamsWithParticipation`](../../../features/exams/dal.ts))
  renvoie **tous** les examens actifs à tout le monde ; le contrôle se fait
  uniquement au démarrage.
- Le garde se trouve dans [`startExam`](../../../features/exams/actions.ts#L372) :
  `if (!isAdmin && !(await hasAccess("exam")))`.
- [`getEligibleExamCandidates`](../../../features/exams/dal.ts) liste (lecture
  seule) les utilisateurs à abonnement `exam` actif — affichage admin.

Les admins veulent pouvoir, à la création, **choisir l'audience** : soit
l'ouverture à tous les abonnés (actuel), soit la restriction à une liste
d'utilisateurs choisis.

## Objectif

Permettre à l'admin de définir par examen **à qui il s'adresse**, sans changer le
comportement des examens existants, et faire respecter ce choix à la fois sur la
**visibilité** (liste) et sur l'**accès** (démarrage/soumission).

## Décisions de conception (validées)

| #  | Sujet                                  | Choix retenu                                                                                              |
| -- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| D1 | Sémantique « restreint »               | **La sélection DONNE l'accès** : un utilisateur choisi peut passer l'examen même **sans** abonnement.    |
| D2 | Bouquet de sélection                   | **Tous les utilisateurs** (recherche serveur), admins inclus (sélectionner un admin est sans effet).     |
| D3 | Visibilité d'un examen restreint       | **Masqué** dans la liste pour les non-sélectionnés (confidentiel/ciblé). Admins voient tout (preview).   |
| D4 | Édition de l'audience après création   | **Modifiable à tout moment** (comme les métadonnées). Les participations déjà enregistrées sont conservées. |
| D5 | Modèle de données                      | **Table de jonction** `examAudience` (vs colonne tableau JSON).                                          |

## Modèle de données

```
exams.audienceType  enum('subscribers' | 'restricted')  -- défaut 'subscribers'

examAudience (nouvelle table)
  examId    text  FK → exams.id  (onDelete cascade)
  userId    text  FK → user.id   (onDelete cascade)
  createdAt timestamp
  PK (examId, userId)
  index sur (userId)   -- filtre liste « mes examens restreints »
```

Migration additive : tous les examens existants prennent `audienceType =
'subscribers'` → comportement actuel **inchangé**. `examAudience` n'est peuplée
que pour les examens restreints.

## Logique d'accès

### `startExam` — nouveau garde

```
admin                          → autorisé (inchangé)
audienceType = 'restricted'    → autorisé SSI EXISTS examAudience(examId, userId)
                                  (aucune vérification d'abonnement)  sinon refus
audienceType = 'subscribers'   → hasAccess("exam")  (inchangé)
```
Message de refus restreint : « Cet examen ne vous est pas destiné. »

### `finalizeExam` (ex-`submitExamAnswers`) — re-vérification miroir

Défense en profondeur (parité avec le re-check `userAccess` actuel) : pour un
examen restreint, re-vérifier l'appartenance à `examAudience` ; pour
`subscribers`, re-vérifier `hasAccess("exam")`.

> Lien Feature 1 : `submitExamAnswers` devient `finalizeExam`. Cette spec
> s'applique au garde, quel que soit le nom final de l'action.

### Liste étudiant — `getExamsWithParticipation`

Inclure un examen si :
- `audienceType = 'subscribers'` (visible par tous, comme aujourd'hui), **ou**
- `audienceType = 'restricted'` **et** `EXISTS examAudience(exam, utilisateur courant)`.

Implémenté via un `EXISTS` corrélé (requête bornée, pas de N+1). Les admins
voient tout (bypass, pour preview).

## UI Admin (création + édition)

Dans [`exam-create-form.tsx`](../../../app/(admin)/admin/exams/create/_components/exam-create-form.tsx)
(et le formulaire d'édition) :

- Nouveau champ **« À qui s'adresse cet examen ? »** (radio) :
  - ◉ *Tous les abonnés aux examens blancs* (défaut)
  - ○ *Utilisateurs spécifiques* → affiche un **multi-select recherchable**
- Le picker réutilise le pattern `Command`/`Popover` de
  [`manual-payment-modal.tsx`](../../../components/shared/payments/manual-payment-modal.tsx),
  alimenté par une **nouvelle DAL `searchSelectableUsers({ query, limit })`**
  (admin-only, recherche serveur sur **tous** les utilisateurs, bornée ~20–50,
  colonnes `{ id, name, email, image }`).
- En édition : **`getExamAudience(examId)`** pré-remplit le picker avec les
  utilisateurs déjà sélectionnés (avec nom/email).
- **Validation zod** : si `audienceType = 'restricted'`, `audienceUserIds` non
  vide (≥ 1) et tous existants ; déduplication avant insert (gotcha
  `onConflictDoUpdate` / Postgres 21000).

### Page détail admin

[`eligible-candidates-section.tsx`](../../../app/(admin)/admin/exams/[id]/_components/eligible-candidates-section.tsx) :
afficher l'audience **selon le type** — `restricted` → la liste sélectionnée ;
`subscribers` → les abonnés actuels (via `getEligibleExamCandidates` existant).

## Actions

- **`createExam`** / **`updateExam`** : acceptent `audienceType` +
  `audienceUserIds`. En transaction :
  - écrire `exams.audienceType` ;
  - si `restricted` : réécrire `examAudience` (delete + insert dédupliqué, valider
    l'existence des `userId`) ;
  - si bascule vers `subscribers` : vider `examAudience`.
  - **Ne jamais toucher `examParticipations`** (audience éditable à tout moment).

## Migration Drizzle (`bun run db:generate` → `db:migrate`)

1. `exams.audienceType` enum (`db/schema/enums.ts`), **défaut `'subscribers'`**.
2. Création de la table `examAudience`.

## Cas limites

- Restreint à audience vide → bloqué par la validation (≥ 1).
- Utilisateur supprimé → `examAudience` nettoyée en cascade FK.
- Non-abonné sélectionné qui passe l'examen puis est retiré de l'audience →
  participation/résultats **conservés** ; il ne peut plus redémarrer (déjà passé).
- Bascule restreint → abonnés avec des sélectionnés → `examAudience` vidée ;
  participations existantes conservées.

## Tests

- **Intégration** (`tests/integration/`, branche Neon éphémère) :
  - `startExam` restreint : membre **sans** abonnement = autorisé ; non-membre =
    refusé ; abonné **non-membre** sur restreint = refusé ; admin = autorisé.
  - `startExam` `subscribers` : comportement actuel inchangé.
  - Liste : examen restreint masqué aux non-membres, visible membres + admin.
  - `createExam`/`updateExam` : persistance `audienceType` + `examAudience`,
    validation (≥ 1, ids existants), dédup, édition après participation.
  - Cleanup FK : supprimer `examAudience` avant `user`/`exams` selon les
    contraintes.
- **Composant/E2E** : radio d'audience + picker conditionnel requis ; recherche
  serveur ; pré-remplissage en édition.

## Hors périmètre (YAGNI)

- Groupes / cohortes réutilisables (entité de 1re classe).
- Import CSV d'utilisateurs dans l'audience.
- Notifications aux utilisateurs sélectionnés (envisageable plus tard).

## Risques

- **Filtrage de la liste** : ajouter l'`EXISTS` corrélé doit rester borné et
  indexé (`examAudience(userId)`). Revue ciblée du plan de requête recommandée.
- **Cohérence des deux gardes** (liste + `startExam` + `finalizeExam`) : la
  sémantique D1 doit être appliquée aux **trois** points, sinon fuite de
  visibilité ou d'accès.
