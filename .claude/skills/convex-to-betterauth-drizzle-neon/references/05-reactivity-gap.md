# 05 — Refermer l'écart de réactivité (la pièce centrale)

Convex `useQuery` est **live** : toute écriture re-render tous les abonnés, gratuitement. Drizzle +
Neon est **requête/réponse**. Ne reconstruis pas un système temps réel global — la plupart des écrans
n'en ont pas besoin. Procède **écran par écran** avec cet arbre de décision.

## Arbre de décision

```
Cet écran a-t-il besoin que les données changent SANS action de l'utilisateur courant ?
│
├─ NON (≈ 90 % des cas : page profil, liste, détail, formulaire)
│   └─► Server Component qui `await` la DAL.
│       La fraîcheur vient de la revalidation déclenchée par les mutations de l'utilisateur :
│       `revalidatePath(path)` ou `revalidateTag(tag)` dans la Server Action,
│       + `router.refresh()` côté client après une action si besoin.
│
├─ OUI, mais seulement après une action de l'utilisateur courant (optimistic UI)
│   └─► `useActionState` + `useOptimistic` (React 19), ou TanStack Query avec
│       invalidation locale. Pas de canal serveur nécessaire.
│
└─ OUI, déclenché par d'AUTRES utilisateurs / le serveur (chat, présence, notifications, dashboards live)
    └─► Choisir une vraie solution live (section ci-dessous). C'est le seul cas coûteux.
```

## Cas 1 & 2 — revalidation (le défaut)

C'est le remplacement direct de la réactivité Convex pour l'écrasante majorité des écrans.

```ts
// Dans la Server Action, après l'écriture :
import { revalidateTag } from "next/cache"

revalidateTag("posts", "max") // ⚠️ Next 16 : 2ᵉ argument requis. Next ≤ 15 : revalidateTag('posts').
```

```ts
// Dans la DAL, taguer la lecture pour que revalidateTag la cible :
import { unstable_cache } from "next/cache"

// ou l'API `use cache` / cacheTag selon ta version de Next
```

> **Garde-fou version** : la mise en cache et l'invalidation par tag ont changé d'API entre Next 14,
> 15 et 16 (`unstable_cache` → directive `use cache` + `cacheTag`/`cacheLife`). **Lis la doc de ta
> version installée** avant d'implémenter cette partie. Le principe reste : _lecture taggée →
> mutation invalide le tag → le Server Component refetch_.

Côté client, après une action, `router.refresh()` force le re-render du segment serveur courant.

## Cas 3 — vrai temps réel (chat, présence, notifications)

Aucune de ces options n'est « gratuite » comme Convex. Choisir selon le besoin :

| Option                                                                        | Quand                                                            | Coût / notes                                                                                                            |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Polling** (`setInterval` + refetch, ou SWR/TanStack `refreshInterval`)      | Fraîcheur « quelques secondes » suffit (badge non-lus, statut)   | Le plus simple. Charge serveur ∝ fréquence × clients. Commence ici.                                                     |
| **SSE** (route handler `app/api/<x>/route.ts` qui stream `text/event-stream`) | Push serveur→client unidirectionnel (notifications, feed)        | Natif, pas de dépendance. Gère reconnexion + nettoyage. Attention aux limites de connexions concurrentes en serverless. |
| **Service temps réel managé** (Pusher, Ably, Supabase Realtime)               | Chat, présence, multi-room, scalabilité                          | Dépendance + coût externes, mais c'est le vrai remplaçant de l'expérience Convex.                                       |
| **Postgres `LISTEN/NOTIFY`** (via le client `pg`)                             | Tu veux que la DB pousse les changements et tu contrôles l'infra | Nécessite une connexion persistante (pas le driver HTTP Neon ; un worker/longue connexion). Plus avancé.                |

**Recette pragmatique** : commence par du **polling** sur les écrans live marqués en phase 1. Si
l'UX exige du sub-seconde (chat actif), passe à un **service managé** pour ces écrans précis,
seulement. Ne globalise pas.

## Anti-patterns

- ❌ Reconstruire un moteur réactif maison pour tout le site. YAGNI — la revalidation couvre presque
  tout.
- ❌ Polling agressif (< 5 s) sur des dizaines d'écrans → tu DDoS ta propre DB. Mesure d'abord.
- ❌ Oublier le 2ᵉ argument de `revalidateTag` en Next 16 (erreur runtime).

## Critère de fin de phase

Chaque écran anciennement `useQuery`-live a une stratégie explicite (revalidate / optimistic /
polling / service), et les écrans non-live affichent des données fraîches après mutation.
