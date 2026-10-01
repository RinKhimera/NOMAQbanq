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
- Le panneau d'examen (`/admin/examens?exam=`) reste un Sheet jusqu'à #264.

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
- **Constitution d'examen** : jusqu'au compositeur de #264, elle garde
  `QuestionDetailModal` + `QuestionSelectModal` (`components/admin/question-browser/`).

## Chiffres clés

`StatBand` (catalogue de `design-system.md`), pas de cartes à icône et
tendance. La liste des questions n'a pas de bande : ses compteurs sont ceux des
onglets. La rangée `AnimatedStatCard` des examens part avec #264.
