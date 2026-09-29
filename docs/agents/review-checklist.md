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
   Une moyenne s'arrondit au plancher (59,67 ≠ « 60 % réussite ») ; une tendance
   se calcule sur les moyennes brutes, jamais comme écart de moyennes arrondies,
   et au plancher aussi : tronquer vers zéro minimise un recul (−1,7 → −1).
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
15. **Enum client recopié à la main.** Une liste de valeurs côté client (schéma zod d'un
    formulaire) qui recopie un enum de la base au lieu d'en dériver diverge au premier
    ajout : la valeur neuve est refusée par l'UI alors que le serveur l'accepte. Dériver
    de l'enum Drizzle, ou verrouiller l'égalité par un test.
16. **Donnée pas encore chargée présentée comme un état certain.** Un `null` de
    chargement (ou d'échec avalé par `.catch(() => {})`) rendu comme « rien à
    signaler » : l'utilisateur agit sur un avertissement qui n'est pas encore arrivé.
    Distinguer chargement / échec / prêt, et ignorer la réponse d'une requête qui ne
    correspond plus à l'élément affiché.
17. **Branche d'écran qui escamote une alerte.** Une variante « vide » ou
    « nouvel utilisateur » choisie sur un sous-ensemble d'états (pas d'accès, pas
    d'historique) masque ce que l'utilisateur doit voir : examen commencé via une
    audience restreinte, accès expiré. Lister tous les états qui produisent une
    alerte avant de décider qui voit la variante.
18. **Verrou d'attente ARIA sans garde.** `aria-disabled` remplace `disabled` pour
    garder le focus, mais le clavier et les boutons voisins restent actifs :
    Entrée resoumet, Échap ou « Annuler » ferment pendant l'envoi et l'échec se
    perd. Chaque gestionnaire (submit, keydown, cancel) teste l'attente.
19. **Variantes responsive en conflit (Tailwind v4).** `max-lg:` l'emporte sur
    `max-[480px]:` dans le CSS généré : la grille reste à deux colonnes sous
    480 px. Écrire les grilles du mobile vers le large
    (`grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4`).
