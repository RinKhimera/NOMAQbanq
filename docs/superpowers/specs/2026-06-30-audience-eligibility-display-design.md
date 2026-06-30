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

- **`subscribers`** : ligne résumé `👥 N candidats éligibles` + bouton **« Voir la
  liste »** → ouvre un **Dialog** contenant `EligibleCandidatesSection` (recherche +
  liste scrollable, déjà existant) en mode `embedded`. La liste = `candidates` (pool
  d'abonnés, déjà fetché côté serveur). Si `N === 0` : « Aucun candidat éligible »,
  bouton masqué.
  - **Plafond du compte (finding 🟠1)** : `getEligibleExamCandidates` cape à 100
    (`dal.ts:1042`). Le résumé affiche le compte exact si `< 100`, sinon **« 100+ »**
    (quand `candidates.length === 100`). Le Dialog affiche une note « 100 premiers —
    recherchez pour affiner » quand la liste est capée. **Pas de nouvelle requête**
    (lecture bornée conservée) ; un `count(*)` exact au-delà de 100 est différé (YAGNI).
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
- **Modifié (mineur, finding 🟡3)** : `EligibleCandidatesSection` reçoit une prop
  `embedded?: boolean` → masque le chrome `Card` (header teal redondant avec le
  titre du Dialog) et rend la hauteur de liste souple (`max-h` au lieu de `h-100`
  fixe) pour ne pas se battre avec le Dialog sur petit écran. Comportement par
  défaut (page détail) inchangé.
- **Supprimé (orphelin)** : `eligible-candidates-card.tsx` (plus aucun consommateur
  après le changement).

### Hors scope (YAGNI)

Page détail `/admin/exams/{id}` (vue lecture seule) inchangée. Pas de lazy-load, pas de
`count(*)` exact au-delà de 100 (« 100+ » suffit), pas de nouveau filtre.

## Tests

Étendre le test e2e F2 admin existant (`admin-exams.spec.ts`, déjà : la bascule
« Utilisateurs spécifiques » révèle le picker) :

- **Précondition (finding 🟠2)** : `global.setup` octroie l'accès examen au compte
  student → **≥1 candidat éligible garanti** dans l'env e2e ; le bouton « Voir la
  liste » n'est donc jamais masqué. (Le cas 0-candidat est géré côté design mais non
  asserté en e2e.)
- Mode **abonnés** (défaut) : le résumé `candidats éligibles` est visible ; cliquer
  « Voir la liste » ouvre le Dialog (présence du champ de recherche).
- Mode **restreint** : le résumé de sélection s'affiche (le pool d'abonnés n'est pas
  montré comme liste).

## Cas limites

- 0 candidat éligible (abonnés) → message « Aucun candidat éligible », bouton masqué.
- 0 sélectionné (restreint) → « Aucun utilisateur sélectionné ».
- Bascule de radio → le bloc se met à jour réactivement (dérivé de `audienceType` /
  `selectedUsers`, déjà des `useWatch`/état existants).

## Trade-off assumé (finding ℹ️5)

Aujourd'hui la liste (top 5 + expand) est visible « d'un coup d'œil » en flux de
création. Approche A la remplace par : un clic de plus (Dialog) en mode abonnés, et
plus de liste inline en mode restreint (le picker la remplace). C'est l'intention
validée — l'admin consulte la liste à la demande, pas en permanence.
