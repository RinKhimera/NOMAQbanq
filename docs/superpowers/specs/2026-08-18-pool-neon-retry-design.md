# Spec — Résilience du pool pg aux réveils Neon (NOMAQBANQ-1F)

- **Date** : 2026-08-18
- **Statut** : DESIGN VALIDÉ (périmètre approuvé en session)
- **Origine** : triage de `NOMAQBANQ-1F` (2026-08-18, `/tarifs`, 1 événement).

## Le problème, prouvé bout à bout

Le 2026-08-18 à 21:00:26 UTC, `GET /tarifs` a répondu 500 : `getAvailableProducts()`
a échoué sur une erreur **Neon 53300** — `Failed to acquire permit to connect to
the database. Too many database connection attempts are currently ongoing`
(logs Vercel, digest `2620800449` identique à celui de l'événement Sentry client).
La même route répondait 200 à 21:01:20. Un visiteur (Abidjan, connexion lente) a
vu l'écran d'erreur générique sur la page des tarifs.

**Cause de la cause** : le compute Neon de production (`ep-round-mouse-adhrcgd8`)
a `suspend_timeout_seconds: 0` → défaut Neon = mise en veille après 5 min
d'inactivité (observé suspendu en direct pendant l'audit). Au réveil, les
tentatives de connexion simultanées des instances serverless peuvent dépasser le
quota d'admission du proxy Neon → 53300.

**Contrainte structurante** : palier Neon gratuit — pas de compute permanent, et
un keep-alive cron doublerait l'`active_time` (~218 h ce mois-ci) au-delà du
quota. Le réveil à 5 min est une donnée. Le correctif est donc côté code.

## Correctif

Deux changements, tous deux dans la couche pool (`db/`).

### 1. `connectionTimeoutMillis: 10_000`

Aujourd'hui absent : un connect qui stalle pend **indéfiniment** — c'est le
résiduel documenté de #103 (`.claude/rules/data-layer.md` : cinq transactions
concurrentes figent l'application entière). 10 s couvre largement un réveil Neon
(~1-2 s) et transforme le gel infini en erreur franche.

Effet de bord assumé : ce timeout s'applique AUSSI à l'attente d'un client libre
quand le pool est saturé (`max: 5`). Une file d'attente de plus de 10 s devient
une erreur au lieu d'un blocage silencieux — c'est voulu : avec des requêtes
normalement en dizaines de ms, 10 s de file signale un problème réel.

### 2. Retry de la phase d'ACQUISITION sur erreur de réveil Neon

Une sous-classe `NeonRetryPool extends Pool` qui surcharge `connect()` — le
point unique par lequel passent `pool.query()` (requêtes Drizzle one-shot,
vérifié dans `pg-pool/index.js:449`) et `pool.connect()` (transactions).

- **Erreurs retentées** (codes pg sur l'erreur brute de connexion) :
  - `53300` — too_many_connections / permit refusé (le cas prouvé) ;
  - `57P03` — cannot_connect_now, « the database system is starting up » (le
    jumeau classique du réveil, même fenêtre, même innocuité).
- **2 retries**, backoff 250 ms puis 1 s. Pire cas d'échec total :
  3 × 10 s + 1,25 s ≈ 31 s avant le 500 — rare et acceptable (le défaut actuel
  est un blocage infini).
- **Pourquoi c'est inconditionnellement sûr, écritures comprises** : le refus de
  « permit » survient à l'établissement de la connexion — AUCUNE requête n'a été
  envoyée. Rejouer l'acquisition ne peut rien dupliquer. C'est ce qui distingue
  ce retry d'un retry de requête, qui resterait réservé aux opérations
  idempotentes.
- **Ce qu'on ne retente PAS** : le timeout de file du pool local (« timeout
  exceeded when trying to connect », sans code pg) — retenter aggraverait la
  saturation ; et toute erreur pg d'une autre nature (auth, réseau, requête).

La forme callback de `connect(cb)` doit être préservée à l'identique de pg-pool
(`cb(undefined, client, client.release)`) : `pool.query` en dépend en interne.

### Structure

- `db/retry-pool.ts` (créer) : `NeonRetryPool` + prédicat `isNeonWakeupError`.
  Retries et backoffs injectables au constructeur — testable sans fake timers,
  aucune dépendance à `lib/env`.
- `db/index.ts` (modifier) : instancier `NeonRetryPool` avec
  `connectionTimeoutMillis`, conserver `pool.on("error")` et
  `attachDatabasePool` tels quels.

## Tests (unitaires, `tests/db/RetryPool.test.ts`, projet frontend)

Le vrai 53300 n'est pas reproductible sur une branche Neon à la demande : on
stubbe `Pool.prototype.connect` (le `super.connect` de la sous-classe).

1. Rejet 53300 ×2 puis succès → `connect()` résout, 3 appels au parent.
2. Rejet 53300 systématique → rejette après épuisement (3 appels, pas plus).
3. Erreur non listée (ex. `28P01` auth) → rejette immédiatement, 1 seul appel.
4. Forme callback : `connect(cb)` reçoit `(undefined, client, client.release)`
   après un retry — le contrat de `pool.query`.
5. `57P03` retenté comme 53300.

Discriminance : les tests 1 et 4 doivent échouer si `NeonRetryPool` est remplacé
par `Pool` nu.

## Règles à mettre à jour

`.claude/rules/data-layer.md` : la règle « jamais d'appel au `db` global dans une
transaction » reste (une 2ᵉ acquisition imbriquée reste un interblocage jusqu'au
timeout), mais sa description change : le pool A désormais un
`connectionTimeoutMillis` — l'interblocage dure 10 s puis erreur, au lieu
d'être indéfini.

## Hors périmètre

- **Trou d'observabilité Sentry serveur** (aucun événement `onRequestError` pour
  les erreurs RSC en prod, prouvé sur -1F) : investigation dédiée, session
  séparée. Sans elle on ne saura pas si CE correctif suffit — à traiter juste
  après.
- `error.tsx` de segment marketing : YAGNI tant que le retry n'a pas montré ses
  limites (le boundary racine a déjà un bouton « Réessayer »).
- Keep-alive cron : écarté (quota compute du palier gratuit).
- `NOMAQBANQ-1D` : archivée (séquelle de l'ancien bug d'hydratation sur
  l'ancienne release, fiber corrompu ; se rouvrira seule si récidive).

## Vérification en production

`NOMAQBANQ-1F` sera marquée résolue au déploiement. Le signal de succès : plus
aucun 500 « Failed query …» avec cause 53300 dans les logs Vercel lors des
réveils, et pas de réouverture de -1F. Attention : tant que le trou Sentry
serveur n'est pas bouché, l'absence d'événement ne prouve PAS l'absence
d'erreur — croiser avec les logs Vercel (rétention ~1 h) sur un réveil provoqué.
