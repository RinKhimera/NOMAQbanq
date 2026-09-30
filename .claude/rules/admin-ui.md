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
- Le panneau d'examen (`/admin/examens?exam=`) reste un Sheet jusqu'à #245.

## Détail d'une question : modale, pas panneau

Le détail d'une question s'ouvre dans `QuestionDetailModal`
(`components/admin/question-browser/`), partagée par le navigateur de questions
(`QuestionManageModal` : Modifier / Supprimer) et la constitution d'examen
(`QuestionSelectModal` : Ajouter / Retirer, sous quota). Plein écran sous
640 px, pied fixe : les actions restent visibles quelle que soit la longueur
de la question. Un nouvel usage fournit son pied, il ne recopie pas le contenu.

## Chiffres clés

`StatBand` (catalogue de `design-system.md`), pas de cartes à icône et
tendance. Les rangées `AnimatedStatCard` des examens et des questions partent
avec #245.
