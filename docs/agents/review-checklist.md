# Classes de défauts à chasser en revue

Les familles de bugs qui ont déjà cassé NOMAQbanq. Une revue adversariale les cherche
une par une dans le changement et dit lesquelles elle a vérifiées. Une classe = un
mécanisme, pas un fichier : elle revient ailleurs sous une autre forme.

1. **Canal de lecture d'une donnée masquée.** Un agrégat, un compteur, un filtre ou une
   statistique qui dérive un champ caché à l'étudiant (justesse en mode test, clé d'un
   examen ouvert, score retenu) le lui rend réponse par réponse. Recenser TOUS les
   dérivés d'un champ masqué, pas seulement ses lectures directes.
2. **Absence convertie en zéro.** `coalesce(…, 0)` sur un agrégat filtré ou une moyenne
   vide fabrique un faux 0 % ; l'absence de donnée vaut `null`, et un `null` qui change
   de sens est invisible à `tsc`.
3. **Chiffre qui flatte.** Un percentile, un taux ou un score présenté à l'utilisateur
   s'arrondit dans le sens qui ne le surestime jamais (« mieux que X % » → plancher).
4. **Requête non déterministe.** Un `distinct on` ou un `order by` qui choisit « la
   dernière » ligne doit départager les ex æquo (deux dates égales) par une clé unique,
   même si les `NULL` sont impossibles ; sous `DESC`, Postgres met en plus les `NULL`
   en tête.
5. **Vérification puis écriture sans verrou.** Sous READ COMMITTED, deux requêtes passent
   le même contrôle ; et après une attente de verrou, seuls les prédicats de la ligne
   cible sont réévalués (un `EXISTS` ou un `FROM` joint garde son instantané). Cas
   fréquent : un cron lit une ligne, puis la « claim » sur son seul marqueur
   (`… IS NULL`) ; entre-temps un autre écrivain a modifié la ligne et ré-armé le
   marqueur (un renouvellement prolonge `expires_at`). Le claim doit exiger la valeur
   lue (compare-and-set), sinon il agit sur un état périmé.
6. **`db` global dans une `db.transaction`.** Le pool (max 5) interbloque sur la
   deuxième connexion imbriquée.
7. **Propriété non vérifiée (IDOR).** Une lecture ou une action qui prend un id du client
   sans le filtrer sur l'utilisateur de la session ; un admin qui court-circuite une
   garde et masque le bug en test.
8. **Octroi d'accès ou paiement hors de son propriétaire.** Toute écriture de
   `user_access` hors `access-ledger.ts` ; une erreur transitoire du webhook acquittée
   en 200.
9. **Envoi de masse au premier passage d'un cron.** Une nouvelle notification sans
   backfill de son marqueur part pour tout l'historique au déploiement.
10. **Schéma et code déployés dans le mauvais ordre.** Retirer une colonne que le code
    en production lit encore (la migration tourne au build, AVANT la bascule).
11. **Horloge du rendu.** `Date.now()` dans un initialiseur ou au rendu SSR diverge à
    l'hydratation ; `performance.now()` s'arrête en veille.
12. **Comparaison sur un texte modifiable.** Une réponse stockée en texte comparée à la
    clé actuelle : une reformulation par un admin réécrit tout l'historique.
13. **Test qui passe que la garde existe ou non.** Il ne teste pas la garde : écrire par
    paires jumelles ; un faux `tx` identique au faux `db`, ou un compteur absolu sur un
    balayage global de la branche, rendent l'assertion tautologique.
14. **Bouton sans `type` dans un `<form>`.** Un `<button>` vaut `type="submit"` par
    défaut : un composant réutilisable (tri, défilement, menu d'un tableau) monté dans
    un formulaire le soumet au clic. Tout bouton d'un composant partagé porte un `type`
    explicite.
