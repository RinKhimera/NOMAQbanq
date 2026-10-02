---
paths:
  - "app/(admin)/**"
  - "components/admin/**"
---

# Admin UI Rules

## Utilisateurs et transactions : pas de panneau latéral

- **Utilisateurs** : une seule vue détaillée, la page `/admin/utilisateurs/[id]`
  (fil d'Ariane). La liste (`?q=&role=&periode=&suspendus=1&segment=&tri=&page=`)
  pagine par offset, 20 lignes, parce qu'elle se trie par colonne.
- **Transactions** : « dossier client ». Liste des clients à gauche (keyset par
  20, `?q=&filtre=&apres=|avant=`), dossier à droite (`?client=`), transaction
  dépliée `?tx=` (posée par `history.replaceState`, sans requête serveur).
  L'historique d'un compte vit dans son dossier, jamais dans la fiche.
- **Etat derive de l'URL** : la page serveur lit les paramètres, l'écran client
  les réécrit dans une transition (rechargement en place, contenu conservé).

## Questions : liste et page de détail

- **Liste** `/admin/questions` : onglets à compteur (Toutes, Clé à vérifier,
  Sans références, un seul passage SQL : `getQuestionTabCounts`), recherche,
  domaine, `FilterPanelButton` (images, dernière utilisation, examen précis,
  objectif dépendant du domaine), 20 lignes par offset. Tout l'état vit dans
  l'URL (`question-params.ts` :
  `?q=&onglet=&domaine=&objectif=&images=&depuis=&examen=&tri=&ordre=&page=`).
- **Détail** `/admin/questions/[id]` : page seule, fil d'Ariane. Elle porte
  les paramètres de la liste d'où l'on vient : précédent / suivant
  (`getQuestionNeighbors`, mêmes filtres et même ordre que la liste, à travers
  les pages), « Retour à la liste », `/modifier` et son retour. Une question
  ouverte par lien direct est « Hors de la liste filtrée ».
- **Contenu du détail** : `QuestionDetailContent`
  (`components/admin/question-detail/`), rendu par la page et, sans actions,
  par un aperçu en Dialog (`examLinks={false}`). Un nouvel usage le réutilise,
  il ne recopie pas la répartition ni les alertes.
- **Constitution d'examen** : le compositeur (voir « Examens blancs »)
  reprend `QuestionDetailContent` en aperçu et le filtre « dernière
  utilisation » de la liste.

## Examens blancs

- **Liste `/admin/examens` = vue de pilotage**, sans onglets, bande ni
  recherche : « En cours » (une carte par examen, participations et
  fermeture), « À préparer » (à venir et en préparation, vérifications de
  `lib/exam-readiness.ts`, la même règle que le récapitulatif du formulaire),
  « Terminés » (tableau, 5 derniers puis le reste). Lecture unique
  `getExamsOverview`, phase par `adminPhaseOf`. Pas de panneau latéral : la
  fiche `/admin/examens/[id]` est la seule vue détaillée.
- **Chiffres d'un examen** (`ExamFigures`) : sur la population du classement
  d'examen (ni admin ni compte supprimé), même si le classement admin montre
  toutes les lignes avec leur badge. Absence de score = « — ».
- **Formulaire** : « Enregistrer » (`saveExam`, titre et visé suffisent),
  « Finaliser » (`saveExam` puis `finalizePreparedExam`, erreurs par étape),
  « Enregistrer les modifications » pour un examen finalisé ; retour sur la
  fiche. Le jeu de questions ne s'y choisit pas.
- **Compositeur** `/admin/examens/[id]/questions` : plan par domaine, banque
  (`getExamBank`, état dans l'URL), sélection, « Compléter les N restantes »
  (`previewExamCompletion` puis `addExamQuestions`). `?retour=fiche|formulaire`
  fixe où ramène « Terminé ». Modifier le jeu d'un examen finalisé sans
  participation le remet en préparation : l'écran le confirme avant la
  première écriture.

## Chiffres clés

`StatBand` (catalogue de `design-system.md`), pas de cartes à icône et
tendance. La liste des questions n'a pas de bande : ses compteurs sont ceux des
onglets ; la liste des examens non plus : ses chiffres vivent dans ses cartes.
