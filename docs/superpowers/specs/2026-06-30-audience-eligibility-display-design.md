# Spec — Affichage contextuel des candidats éligibles (formulaire d'examen admin)

**Date :** 2026-06-30 · **Scope :** `/admin/exams/create` + `/admin/exams/edit/[id]`

## Problème

Sur le formulaire de création/édition d'examen, `EligibleCandidatesCard` est affichée
**en permanence**, en bas du formulaire, **quelle que soit l'audience choisie**. Deux
défauts :

1. **Clutter** : la liste est toujours là, même quand l'admin ne la consulte pas.
2. **Incohérence sémantique** : « Candidats éligibles » = *abonnés avec accès examen
   actif* (`getEligibleExamCandidates`). C'est juste pour une audience **abonnés**,
   mais **hors-sujet pour un examen restreint** : l'accès y est octroyé aux
   utilisateurs **choisis** (même sans abonnement), pas au pool d'abonnés.

## Objectif

Rendre l'affichage des candidats éligibles **contextuel à la radio d'audience**, avec
un **résumé toujours visible** et la **liste à la demande**. (Approche A validée.)

## Design

Un composant client `AudienceEligibility` monté **dans** la carte « À qui s'adresse cet
examen ? », après le `RadioGroup` (et le picker en mode restreint). Il rend, selon
`audienceType` :

- **`subscribers`** : ligne résumé `👥 N candidats éligibles` (+ `· M expirant bientôt`
  si M>0) + bouton **« Voir la liste »** → ouvre un **Dialog** contenant
  `EligibleCandidatesSection` (recherche + liste scrollable, déjà existant). La liste =
  `candidates` (pool d'abonnés, déjà fetché côté serveur). Si `N === 0` : « Aucun
  candidat éligible », bouton masqué.
- **`restricted`** : ligne résumé `N utilisateur(s) sélectionné(s)` (depuis
  `selectedUsers.length`) + micro-texte « L'accès est octroyé aux utilisateurs
  sélectionnés, même sans abonnement ». **Pas de Dialog** : le `UserMultiSelect`
  (rendu juste au-dessus) **est** la liste. Si 0 sélectionné : « Aucun utilisateur
  sélectionné ».

### Props

```ts
interface AudienceEligibilityProps {
  candidates: EligibleCandidate[]   // pool d'abonnés (déjà chargé par la page)
  audienceType: "subscribers" | "restricted"
  selectedCount: number             // selectedUsers.length (mode restreint)
}
```

### Données

`getEligibleExamCandidates()` **reste fetché côté serveur** (les pages create/edit le
font déjà) : on a besoin du **compte** pour le résumé, et le Dialog réutilise la donnée
déjà chargée → ouverture instantanée. **Pas de lazy-load / pas de nouvel endpoint.**

### Fichiers

- **Nouveau** : `app/(admin)/admin/exams/_components/audience-eligibility.tsx`.
- **Modifiés** : `exam-create-form.tsx` + `exam-edit-form.tsx` — retirer le
  `<EligibleCandidatesCard candidates={candidates} />` standalone ; monter
  `<AudienceEligibility candidates={candidates} audienceType={audienceType}
  selectedCount={selectedUsers.length} />` dans la carte audience.
- **Réutilisé** : `EligibleCandidatesSection` (dans le `DialogContent` ; on peut
  alléger le chrome Card pour le rendu en dialog, détail d'implémentation).
- **Supprimé si orphelin** : `eligible-candidates-card.tsx` (plus aucun consommateur
  après le changement — vérifier puis supprimer).

### Hors scope (YAGNI)

Page détail `/admin/exams/{id}` (vue lecture seule) inchangée. Pas de lazy-load, pas de
refonte de `EligibleCandidatesSection`, pas de nouveau filtre.

## Tests

Étendre le test e2e F2 admin existant (`admin-exams.spec.ts`, déjà : la bascule
« Utilisateurs spécifiques » révèle le picker) :

- Mode **abonnés** : le résumé `candidats éligibles` est visible ; cliquer « Voir la
  liste » ouvre le Dialog (présence du champ de recherche).
- Mode **restreint** : le résumé de sélection s'affiche (le pool d'abonnés n'est pas
  montré comme liste).

## Cas limites

- 0 candidat éligible (abonnés) → message « Aucun candidat éligible », bouton masqué.
- 0 sélectionné (restreint) → « Aucun utilisateur sélectionné ».
- Bascule de radio → le bloc se met à jour réactivement (dérivé de `audienceType` /
  `selectedUsers`, déjà des `useWatch`/état existants).
