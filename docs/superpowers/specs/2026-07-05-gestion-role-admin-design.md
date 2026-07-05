# Spec — Gestion du rôle administrateur depuis la fiche utilisateur

**Date** : 2026-07-05
**Statut** : validé (brainstorming) ; revue adversariale design du 2026-07-05
triée — fermeture des endpoints admin Better Auth ajoutée, tests renforcés
(toasts, idempotence sans écriture)

## Contexte

Un seul administrateur existe aujourd'hui, promu à la main dans la base (colonne
`user.role`, enum `user_role = "user" | "admin"`, `db/schema/enums.ts`). Il faut
permettre à un admin de promouvoir ou rétrograder n'importe quel utilisateur
depuis l'interface, sans toucher à la base.

**Emplacement retenu** : la fiche utilisateur admin `/admin/utilisateurs/[id]`
(option validée en brainstorming). Pas de page dédiée : l'enum n'a que deux
valeurs, la « vue d'ensemble des admins » existe déjà via le filtre rôle de
`/admin/utilisateurs`.

## Portée

- Une carte « Rôle administrateur » dans la fiche utilisateur admin.
- Une Server Action `updateUserRole` (promotion **et** rétrogradation).
- La fermeture des endpoints HTTP inutilisés du plugin admin Better Auth
  (`disabledPaths`), pour que `updateUserRole` soit l'**unique** chemin de
  mutation du rôle.
- Tests d'intégration (action) + tests frontend (carte).

**Hors scope v1** (à proposer séparément si besoin) : notification email au
promu, table d'audit, rôles intermédiaires (modérateur…), gestion depuis le
side panel de la liste.

**Suite recommandée** (constat 🟡 de la revue du 2026-07-05) : durcir le
TOCTOU de `deleteMyAccount` — la branche « dernier admin » est gatée sur le
rôle porté par la session (`actions.ts:327`), pas re-lu sous verrou ; fenêtre
très étroite (trois requêtes quasi simultanées) rendue théoriquement
atteignable par la promotion in-app. Correctif : décider la branche admin sur
le rôle lu en base sous verrou.

## UX — carte « Rôle administrateur »

Nouveau composant client
`app/(admin)/admin/utilisateurs/[id]/_components/user-role-section.tsx`, rendu
dans `user-detail-client.tsx`, colonne gauche sous `UserInfoCard` (le rôle
relève de l'identité, pas des accès payants). Style : carte `rounded-2xl` +
`motion` comme les sections existantes.

États :

| Cas                                                    | Affichage                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `role === "user"`                                      | Description courte du rôle admin + bouton « Promouvoir administrateur » |
| `role === "admin"`                                     | Bouton destructif (outline) « Retirer le rôle administrateur »          |
| Fiche du viewer lui-même (`user.id === currentUserId`) | Pas de bouton — note « Vous ne pouvez pas modifier votre propre rôle »  |

- Clic → `AlertDialog` (shadcn) : nom + email de la cible, phrase expliquant la
  conséquence (accès complet au back-office / perte de cet accès), bouton
  d'action explicite. Pas de saisie à retaper : l'action est réversible en un
  clic, contrairement à la suppression de compte.
- Pendant l'appel : bouton désactivé (`useTransition`).
- Succès : toast + `router.refresh()` — le badge rôle de `UserInfoCard` se met
  à jour via le refetch serveur de la page. Échec : toast d'erreur avec le
  message renvoyé par l'action.
- La page serveur (`[id]/page.tsx`) capture la session de `requireRole` et
  passe `currentUserId` au client (uniquement l'id — jamais l'objet session,
  cf. `data-layer.md` PII).

## Server Action `updateUserRole`

Dans `features/users/actions.ts`, schéma zod dans `features/users/schemas.ts`.

```
updateUserRole(input: { userId: string; role: "user" | "admin" })
  → { success: true } | { success: false; error: string }
```

Séquence : `requireRole(["admin"])` → `safeParse` → règles → transaction →
`revalidatePath("/admin/utilisateurs")` + `revalidatePath("/admin/utilisateurs/{userId}")`.

Règles, dans l'ordre :

1. **Auto-modification interdite** : `input.userId === session.user.id` →
   erreur « Vous ne pouvez pas modifier votre propre rôle. » Couvre
   l'auto-rétrogradation (lock-out en un clic) et l'auto-promotion (no-op
   inutile).
2. **Transaction** avec deux verrous `for update` (ordre déterministe par id
   pour éviter tout deadlock entre appels croisés) :
   - Ligne **de l'appelant** : re-check `role = "admin"` et
     `deletedAt IS NULL`. S'il n'est plus admin actif → erreur. Combiné à la
     règle 1, cela garantit l'invariant **« jamais zéro admin actif »** sans
     compter les admins : après l'écriture il reste au moins l'appelant.
     (Couvre la race « l'appelant vient d'être rétrogradé par un autre
     admin » — `requireRole` seul est un check hors transaction.)
     L'invariant suppose que `updateUserRole` est l'unique chemin de mutation
     du rôle — c'est ce que garantit la fermeture des endpoints du plugin
     admin ci-dessous.
   - Ligne **de la cible** : doit exister et `deletedAt IS NULL`, sinon erreur
     « Utilisateur introuvable. » Si `role` déjà égal à la valeur demandée →
     succès sans écriture (idempotent).
   - Écriture : `update user set role = … where id = …`.

### Fermeture des endpoints du plugin admin Better Auth

Le plugin `admin` (`lib/auth.ts:106`) n'est configuré que pour porter le champ
`role` sur `session.user`. Il expose pourtant **15 endpoints HTTP** via la
route catch-all `/api/auth/[...all]` — dont `POST /admin/set-role` (aucune
garde d'auto-modification ni de dernier admin : un admin peut se rétrograder
lui-même en un fetch) et `POST /admin/remove-user` (suppression **dure**, qui
contourne la garde « dernier admin » de `deleteMyAccount`). Aucun code de
l'application ne les appelle (vérifié : zéro usage de `authClient.admin.*` /
`auth.api.setRole` etc.). Sans fermeture, l'invariant ci-dessus est faux.

Correctif : l'option **`disabledPaths`** de Better Auth (vérifiée sur la
1.6.20 installée : match exact au niveau du routeur HTTP → 404), listant les
15 endpoints du plugin. Limites assumées :

- match **exact** — re-vérifier la liste à chaque montée de version de
  better-auth (un nouvel endpoint du plugin ne serait pas couvert) ;
- `disabledPaths` ne s'applique qu'à la surface HTTP ; les appels serveur
  `auth.api.*` la contournent (aucun dans l'app, et ils resteraient sous
  notre contrôle).

### Fraîcheur du rôle / sessions

Aucune révocation de sessions nécessaire : `lib/auth.ts` n'a pas de
`cookieCache`, Better Auth relit l'utilisateur en base à chaque
`getSession`. Le rétrogradé perd la zone admin à sa prochaine requête (les
layouts/DAL/Actions re-gardent tous côté serveur) ; le promu la gagne pareil.

### Messages d'erreur (FR)

- « Vous ne pouvez pas modifier votre propre rôle. »
- « Utilisateur introuvable. » (cible inexistante ou supprimée)
- « Votre compte n'a plus les droits administrateur. » (re-check appelant)
- « Données invalides » (zod, message de l'issue si disponible)

## Tests

**Intégration** (`tests/integration/users-role.test.ts`, branche Neon éphémère,
mocks `@/lib/auth-guards` comme `users-account.test.ts` — y ajouter
`requireRole`) :

- promotion `user → admin` (row mise à jour) ;
- rétrogradation `admin → user` ;
- idempotence (même rôle demandé → succès, **aucune écriture** : `updatedAt`
  — qui a `$onUpdate` — doit rester inchangé) ;
- refus auto-modification ;
- refus si l'appelant n'est plus admin actif en base (re-check transactionnel) ;
- refus cible inexistante / soft-deleted ;
- zod : `role` hors enum refusé.

**Frontend** (happy-dom, `tests/`) : `user-role-section` — bouton selon le
rôle, cas « propre fiche » (pas de bouton), ouverture du dialog, appel de
l'action au confirm (action mockée), toast succès/erreur.

## Fichiers touchés

| Fichier                                                                 | Changement                                                     |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| `features/users/schemas.ts`                                             | + `updateUserRoleSchema`                                       |
| `features/users/actions.ts`                                             | + `updateUserRole`                                             |
| `lib/auth.ts`                                                           | + `disabledPaths` (fermeture des 15 endpoints du plugin admin) |
| `app/(admin)/admin/utilisateurs/[id]/page.tsx`                          | capture la session, passe `currentUserId`                      |
| `app/(admin)/admin/utilisateurs/[id]/user-detail-client.tsx`            | rend `UserRoleSection` (colonne gauche)                        |
| `app/(admin)/admin/utilisateurs/[id]/_components/user-role-section.tsx` | nouveau composant                                              |
| `tests/integration/users-role.test.ts`                                  | nouveau                                                        |
| `tests/*` (frontend)                                                    | nouveau test composant                                         |

Aucun changement de schéma DB (la colonne, l'enum et l'index `user_role_idx`
existent déjà) ; aucune migration.
