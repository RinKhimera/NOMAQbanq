# Audit Sentry — khimera-9h/nomaqbanq

> Date : 2026-08-05. Branche `feat/stripe-fiabilite-paiements`, release déployée `d87884bf`.
> Passe live effectuée (`sentry auth status` exit 0) : les volumes cités viennent du compte,
> pas d'une estimation. Deux correctifs appliqués pendant l'audit (§ Correctifs appliqués).
> Point de départ : investigation de l'issue `NOMAQBANQ-5` (Hydration Error, `/tarifs`).

## Verrou d'identité

DSN → organisation `4510410010787842`, projet `4510410016227333`.
Confronté au compte : `slug=nomaqbanq id=4510410016227333 platform=javascript-nextjs` ✓.

L'organisation porte trois projets (`nomaqbanq`, `fantribe`, `mes-contacts`) et **le quota est
celui de l'organisation**. Ventilation faite avant de chiffrer quoi que ce soit : sur 90 jours,
la totalité de la consommation replay auditée ici vient de `nomaqbanq` (160 acceptés,
350 rejetés, 213 abandonnés côté client, 10 filtrés — aucune ligne pour les deux autres
projets). Sur les erreurs (30 j) : 207 acceptées pour `nomaqbanq`, 39 pour `fantribe`.

Plan : **Developer (`am3_f`)**, période courante 2026-07-22 → 2026-08-21, `onDemandMaxSpend: 0`.

| Catégorie | Réservé | Consommé (période courante) |
| --- | --- | --- |
| errors | 5 000 | **12** |
| replays | 50 | **42** |
| spans | 5 000 000 | 103 751 |
| logBytes | 5 | 0 |

---

## Ce qui est solide

- **Les trois runtimes sont initialisés et réellement chargés.** `instrumentation.ts:4-10`
  branche server et edge sur `NEXT_RUNTIME`. Pas d'angle mort de runtime — c'est l'oubli le
  plus fréquent sur Next.js et il n'est pas présent ici.
- **Garde d'environnement homogène sur les trois configs** :
  `NODE_ENV === "production" && NEXT_PUBLIC_SENTRY_DISABLED !== "1"`. Le kill-switch couvre le
  cas des e2e tournant sur un build de production, que la plupart des projets ratent — c'est
  ce qui garantit que les chiffres ci-dessus décrivent du vrai trafic.
- **Mode buffer pur en place** (`instrumentation-client.ts:37`, `replaysSessionSampleRate: 0`),
  avec un commentaire qui documente le piège du quota. C'est le correctif de la panne de
  juin-juillet ; il a divisé le débit sans le ramener sous le seuil (voir SENTRY-01).
- **Point de capture serveur unique et discipliné** : `lib/observability.ts:22-26` n'envoie que
  `tags: { action }` statique, `user: { id }` et `extra: { detail }`. Aucun `setContext` /
  `setExtra` ailleurs dans `app/`, `features/`, `lib/`, `components/` — les règles « payload
  complet en contexte » et « contexte utilisateur trop riche » ne se déclenchent pas.
- **`tracesSampleRate: 1` côté serveur est justifié ici** : 103 751 spans sur 5 000 000
  réservés, soit 2 % du quota. À ne pas « corriger ».

---

## Constats

### 🔴 SENTRY-01 · Le quota replay se rouvre en aveugle d'ici quelques jours

**Preuve** : `stats_v2`, catégorie `replay`, 90 jours, `project=4510410016227333` →
`rate_limited = 350`, réparti sur **23 jours distincts, du 2026-06-21 au 2026-07-21**.
Période courante : `usage 42 / reserved 50`, dont **37 acceptés sur les 14 derniers jours**.
`onDemandMaxSpend: 0` — aucun dépassement payant possible.

**Impact** : au rythme mesuré (~2,6 replays/jour), les 8 replays restants partent vers le
**8 août**, puis plus aucun replay jusqu'au 21 août — sans notification, sans rien dans
l'interface. C'est la répétition de l'épisode de juin : le passage en mode buffer a réduit le
débit, il ne l'a pas ramené sous 50/mois. Un plateau de 23 jours n'est pas un pic de
protection anti-spike, c'est un état structurel.

**Correctif** : traiter la cause du volume, pas le taux. Le déclencheur dominant est l'issue
d'hydratation ; maintenant que le filtre est levé (§ Correctifs appliqués), elle devient
diagnosticable. Si une issue reste bruyante entre-temps, `beforeErrorSampling` l'exclut du
déclenchement de replay **sans** cesser de capturer l'erreur elle-même.

---

### 🔴 SENTRY-02 · Les erreurs filtrées à l'ingestion consommaient le quota replay

**Statut : corrigé pendant l'audit.** Conservé ici parce que le mécanisme est contre-intuitif
et se reproduira au prochain filtre entrant activé.

**Preuve** : `filters:react-hydration-errors = true` dans les options du projet ; ventilation
des `filtered` sur 14 jours → `react-hydration-errors: 32`, `web-crawlers: 5`,
`chunk-load-error: 1`. En face : `sentry replay list --period 30d` → **41 replays sur 42 avec
`count_errors: 0`**. Les deux replays d'hydratation inspectés (`6162e2cf…`, `c470f315…`)
portent chacun un `errorId` (`0d853683…`, `6259a38b…`) **introuvable dans le dataset
`errors`**.

**Mécanisme** : le SDK envoie le replay depuis le navigateur ; le filtre entrant agit à
l'ingestion, donc après. Le replay est facturé, l'erreur qui l'expliquait est jetée. Le filtre
économisait le quota abondant (12 erreurs consommées sur 5 000) au prix du quota rare
(42 replays sur 50) — et rendait l'issue non diagnosticable : `occurrence.evidenceData` est
vide, il n'y a aucun diff serveur/client à lire.

**Leçon transposable** : avant d'activer un filtre entrant, vérifier s'il coupe une famille
d'erreurs qui déclenche des replays. Le bon endroit pour couper du bruit navigateur reste
`lib/sentry-filters.ts` — versionné, commenté, testable.

---

### 🟠 SENTRY-03 · Filtrage présent uniquement côté client

**Preuve** : occurrences de `beforeSend|ignoreErrors|denyUrls` par fichier →
`instrumentation-client.ts: 1`, `sentry.server.config.ts: 0`, `sentry.edge.config.ts: 0`.

**Impact** : le serveur reçoit du trafic réel — Server Actions, webhook Stripe, crons — et n'a
aucun garde-fou. L'asymétrie est presque toujours un oubli : le filtre `$RS` a été ajouté là où
le problème se manifestait, sans que la question se pose pour les autres runtimes. Le jour où
une erreur serveur devient bruyante, rien ne la contient.

**Correctif** : un `beforeSend` partagé importé par les trois configs, plutôt que trois
recopies — la recopie diverge au premier ajout.

---

### 🟠 SENTRY-04 · Taux de traces incohérents entre runtimes

**Preuve** : `tracesSampleRate: 1` dans `sentry.server.config.ts:17` et
`sentry.edge.config.ts:18`, contre `0.15` dans `instrumentation-client.ts:27`.
`client_discard` sur les transactions : 28 035 en 90 jours.

**Impact** : 85 % des pageloads navigateur sont écartés alors que le span serveur correspondant
est conservé. Une trace tronquée est souvent pire qu'une trace absente : elle donne l'illusion
d'une chaîne complète et fait chercher au mauvais endroit. C'est exactement ce qui a compliqué
la lecture de la trace de `NOMAQBANQ-5`.

**Correctif** : aligner, ou commenter l'arbitrage. Vu la marge sur les spans (2 % du quota),
monter le client à 1 est jouable ; le contraire (baisser le serveur) perdrait de la donnée sans
rien économiser d'utile.

---

### 🟡 SENTRY-05 · `enableLogs: true` sur les trois runtimes, zéro octet consommé

**Preuve** : `enableLogs: true` dans les trois configs ; `categories.logBytes` →
`reserved: 5, usage: 0`.

**Impact** : soit l'application n'émet aucun log Sentry et l'option ne sert à rien, soit les
logs n'arrivent pas. Dans les deux cas, on croit disposer d'une capacité de diagnostic qui
n'existe pas. Le quota de logs du plan Developer étant minuscule, l'activer sans l'utiliser
n'est pas neutre non plus le jour où on s'en servira.

---

### 🟡 SENTRY-06 · Écart entre le commentaire et la configuration globale

**Preuve** : `lib/observability.ts:13` écrit « pas de payload (PII) dans les événements », alors
que `sendDefaultPii: true` joint adresse IP, en-têtes et cookies sur les trois runtimes.

**Nuance qui empêche d'en faire une faute** : le commentaire est exact pour ce que le helper
construit lui-même, et `sendDefaultPii: true` est le défaut recommandé par Sentry. Le risque
n'est pas technique, il est documentaire : une réponse à un audit de conformité s'appuierait sur
le commentaire.

**Correctif** : préciser que le helper n'ajoute pas de payload, et que l'IP et les en-têtes
viennent du réglage global.

---

## Arbitré — ne pas ressortir aux prochains audits

- **Session Replay non masqué** (`maskAllText: false`, `blockAllMedia: false`,
  `instrumentation-client.ts:20-23`) : **assumé explicitement par le propriétaire du projet le
  2026-08-05.** Le compromis est connu — les replays enregistrent nom, courriel, écrans
  d'abonnement et de paiement, et le contenu des questions — et tranché en faveur de
  l'utilité de débogage. Ne pas le reproposer sans élément nouveau.

---

## Correctifs appliqués pendant l'audit

1. **`filters:react-hydration-errors` → `false`**, de façon permanente (voir SENTRY-02).
   Appliqué via les options du projet : l'endpoint `projects/<org>/<projet>/filters/<id>/`
   renvoie 404 pour ce filtre, il faut passer par
   `PUT projects/<org>/<projet>/` avec `{"options": {"filters:react-hydration-errors": false}}`.
   Relu après écriture : `false` ✓. Effet estimé : ~70 erreurs/mois supplémentaires sur
   5 000 réservées (12 consommées).

2. **Suppression d'une lecture d'horloge au rendu**, `components/shared/payments/access-badge.tsx`.
   `getAccessStatus()` appelait `Date.now()` dans le corps de rendu de `PricingCard`,
   `PricingGrid`, `PremiumPricingCard`, `UserAccessSection`, `AbonnementsClient` et
   `PaymentSuccessClient` : serveur et navigateur évaluant l'horloge à des instants différents,
   le badge pouvait basculer `active` → `expired` entre le SSR et l'hydratation. Le statut
   dérive désormais de `daysRemaining`, calculé serveur. L'invariant qui rend l'horloge inutile
   est tenu par les deux producteurs : `AccessInfo` renvoie `null` pour un accès échu
   (`features/payments/dal.ts:24`), `PanelAccess` ramène `daysRemaining` à 0
   (`features/users/dal.ts:603`). Un test affirmait `(futur, 0) → "expiring"`, état qu'aucune
   DAL ne produit (`Math.ceil` d'un délai positif vaut au minimum 1) ; remplacé par une
   assertion sur la nouvelle sémantique. `bun run check` exit 0, 108 fichiers / 1233 tests.

---

## Ce que je n'ai pas pu vérifier

- **Catégorie `log`** : l'appel `stats_v2` sort en code 60 avec un corps vide. Aucune mesure —
  à ne pas lire comme « zéro ». SENTRY-05 s'appuie sur `categories.logBytes` de
  `customers/<org>/`, pas sur cet appel.
- **Réglages de scrubbing côté console Sentry** : non exposés par les endpoints interrogés. Le
  scrubbing par défaut connaît `password`, `secret`, `token` mais ignore le vocabulaire métier
  (`reponseEtudiant`, identifiants de participation). À vérifier dans l'interface.
- **La cause racine de `NOMAQBANQ-5`** : les erreurs React arrivent désormais dans Sentry, mais
  il faut du trafic pour en capturer une. Piste principale non confirmée : mutation du DOM par
  la traduction automatique de Chrome Android — cohérente avec les faits établis (SSR de
  `/tarifs` byte-identique entre deux requêtes après neutralisation de la balise
  `sentry-trace` ; `Cache-Control: private, no-store` donc aucun partage inter-utilisateurs ;
  aucun rendu conditionnel au user-agent ou au viewport dans l'arbre, le responsive étant
  purement CSS ; même famille que le crash `$RS` déjà filtré). **À confirmer par l'événement
  réel avant d'agir dessus.**
