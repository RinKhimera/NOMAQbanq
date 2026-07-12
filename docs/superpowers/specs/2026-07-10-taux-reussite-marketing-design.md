# Spec — Taux de réussite marketing honnête et centralisé (#84 + #85)

**Date** : 2026-07-10
**Statut** : validé (brainstorming) — en attente de revue adversariale design
**Issues** : #84 (centralisation éditoriale, `good first issue`) + #85 (vrai calcul,
dépend de #84). Sous-issues de l'epic #78. Traitées ensemble (une seule spec /
un seul plan) car #85 réconcilie le type que #84 rend honnête.

## Contexte

`features/marketing/dal.ts` renvoie `successRate: "85%"` et `rating: "4.9/5"` en
dur, à côté de `totalQuestions`/`totalUsers`/`totalDomains` réellement calculés
en SQL — le type `MarketingStats` ment (il présente de l'éditorial comme du
calculé). Les mêmes valeurs sont AUSSI codées en dur dans le JSX (home-landing,
a-propos, tarifs) et dans les metadata SEO de `a-propos/page.tsx`.

## Portée

- **#84** : sortir l'éditorial du DAL, le centraliser dans `constants/index.tsx`,
  faire lire cette source par tous les points d'affichage.
- **#85** : rendre `successRate` réellement calculé à partir des participations
  d'examens terminées, avec seuil de volume ET plancher de publication.

**Hors scope** : vrai système d'avis pour `rating` (aucune table d'avis en base —
reste éditorial) ; tout changement visuel ; le `4.9/5` du carrousel de
témoignages (`components/marketing/testimonials-carousel.tsx` : `rating` par
témoignage fictif, sans rapport avec le claim global).

## Décisions de design (tranchées en brainstorming)

- **Plancher de publication** : le taux calculé n'est affiché que s'il est
  **≥ 70 %** ; sinon on retombe sur le claim éditorial. La page tarifs est une
  page de vente — afficher « 42 % de réussite » serait un autogoal. Ne dégrade
  rien vs aujourd'hui (le 85 % actuel est déjà 100 % éditorial).
- **Seuils** : réussite = `score ≥ 60` ; crédibilité = **≥ 50** participations
  terminées ; « terminé » = statut `completed` **OU** `auto_submitted` (convention
  du repo : un examen auto-soumis à l'expiration est un vrai passage).

## 1. Constante éditoriale (#84)

Dans `constants/index.tsx` :

```ts
/**
 * Claims marketing ÉDITORIAUX (non calculés). `successRate` sert de repli quand
 * le vrai taux (features/marketing/dal.ts) n'est pas publiable (volume ou
 * plancher). `rating` reste 100 % éditorial : aucun système d'avis en base.
 */
export const MARKETING_CLAIMS = {
  successRate: "85%",
  rating: "4.9/5",
} as const
```

## 2. Type `MarketingStats` (#84 + #85)

- **Retire `rating`** (aucun consommateur via le DAL — les « 4.9/5 » affichés
  sont du JSX en dur qui lira `MARKETING_CLAIMS.rating`). Pas de migration.
- **Garde `successRate`**, désormais honnête : soit `"NN%"` calculé, soit le
  claim éditorial. Le type ne ment plus (tout ce qu'il expose est soit calculé,
  soit explicitement un repli documenté — pas « faux calcul »).

## 3. Calcul du taux (#85)

### Fonction pure de bascule — `features/marketing/lib.ts`

Testable sans DB (unit) :

```ts
export const SUCCESS_SCORE_THRESHOLD = 60 // score (%) d'une participation réussie
export const MIN_COMPLETED_PARTICIPATIONS = 50 // volume minimal pour publier un calcul
export const MIN_PUBLISHABLE_SUCCESS_RATE = 70 // plancher marketing (page de vente)

/**
 * Décide de la valeur affichée : le taux calculé arrondi, OU le claim éditorial
 * si le volume est insuffisant ou si le taux est sous le plancher de publication.
 */
export const resolveSuccessRate = ({
  completed,
  passed,
}: {
  completed: number
  passed: number
}): string => {
  if (completed < MIN_COMPLETED_PARTICIPATIONS)
    return MARKETING_CLAIMS.successRate
  const rate = Math.round((passed / completed) * 100)
  if (rate < MIN_PUBLISHABLE_SUCCESS_RATE) return MARKETING_CLAIMS.successRate
  return `${rate}%`
}
```

### Agrégat SQL — dans `getMarketingStats`

Une seule requête agrégée supplémentaire (règle « Reads bornés » : `count(*)
filter (where …)`, jamais de lecture de lignes) :

```ts
const [participationAgg] = await db
  .select({
    completed:
      sql<number>`count(*) filter (where ${examParticipations.status} in ('completed','auto_submitted'))`.mapWith(
        Number,
      ),
    passed:
      sql<number>`count(*) filter (where ${examParticipations.status} in ('completed','auto_submitted') and ${examParticipations.score} >= ${SUCCESS_SCORE_THRESHOLD})`.mapWith(
        Number,
      ),
  })
  .from(examParticipations)
```

`successRate: resolveSuccessRate({ completed: participationAgg?.completed ?? 0, passed: participationAgg?.passed ?? 0 })`.

## 4. Points d'affichage

| Fichier / ligne                                    | Aujourd'hui                             | Après                                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/marketing/dal.ts`                        | `successRate: "85%"`, `rating: "4.9/5"` | `successRate` calculé ; `rating` **supprimé** du type/retour                                                                                                         |
| `tarifs/_components/pricing-header.tsx:20`         | `marketingStats?.successRate`           | inchangé (déjà via stats)                                                                                                                                            |
| `tarifs/_components/pricing-header.tsx:137`        | `4.9/5` en dur                          | `MARKETING_CLAIMS.rating`                                                                                                                                            |
| `a-propos/_components/about-story.tsx:33`          | `stats?.successRate ?? "85%"`           | `stats?.successRate ?? MARKETING_CLAIMS.successRate`                                                                                                                 |
| `a-propos/_components/a-propos-page-client.tsx:58` | `85% de réussite` en dur                | brancher `useMarketingStats` (composant déjà `"use client"`) → `{stats?.successRate ?? MARKETING_CLAIMS.successRate}` (cohérence avec `about-story` de la même page) |
| `_components/home-landing.tsx:212`                 | `85% de réussite` en dur                | `{stats?.successRate ?? MARKETING_CLAIMS.successRate}` (le composant consomme déjà `useMarketingStats`)                                                              |
| `_components/home-landing.tsx:225`                 | `4.9/5` en dur                          | `MARKETING_CLAIMS.rating`                                                                                                                                            |
| `a-propos/page.tsx:7,17` (metadata SEO)            | `85% de taux…` en dur                   | `MARKETING_CLAIMS.successRate` interpolé                                                                                                                             |

**Exception assumée — metadata SEO** : `a-propos/page.tsx` est un Server
Component qui exporte `metadata` statique ; on n'y fera **pas** de requête DB
pour un chiffre de description. Il lit `MARKETING_CLAIMS.successRate` (l'éditorial),
qui peut diverger du taux calculé affiché dans le corps de page. Assumé : une
description SEO n'est pas un contrat de chiffre, et centraliser via la constante
supprime déjà la duplication littérale (critère d'acceptation #84).

**Décision de branchement** `a-propos-page-client.tsx` / `home-landing.tsx` : si
le composant consomme déjà `useMarketingStats`, afficher `stats.successRate`
(vrai taux) ; sinon lire `MARKETING_CLAIMS.successRate` (constante) plutôt que
d'ajouter un fetch — à trancher fichier par fichier au plan selon l'existant. Le
critère #84 (« un seul endroit à changer ») est satisfait dans les deux cas : la
valeur vient soit du DAL (calcul + repli constante), soit directement de la
constante.

## 5. Tests

- **Unit** (`tests/marketing/success-rate.test.ts`, happy-dom) — `resolveSuccessRate` :
  sous-volume (49 → éditorial) ; au seuil exact (50, taux ≥ 70 → calculé) ;
  plancher (69 % → éditorial, 70 % → calculé) ; arrondi (`Math.round`) ; 0
  participation (pas de division par zéro). Assertions sur la constante réelle
  `MARKETING_CLAIMS.successRate`.
- **Intégration** (`tests/integration/marketing-dal.test.ts`, branche Neon) —
  l'agrégat SQL en **delta-vs-baseline** (table `exam_participations` partagée
  entre fichiers : lire la baseline `completed`/`passed`, insérer des
  participations connues via un examen + N users dédiés — contrainte `UNIQUE(examId,
userId)` oblige des users distincts —, assert le delta ; cleanup FK exams→users).
  Vérifie que `getMarketingStats().successRate` reflète le calcul quand le total
  (baseline + insérées) dépasse 50 et le plancher, sinon l'éditorial.
- **MAJ** `tests/hooks/useMarketingStats.test.tsx` : le mock `MarketingStats`
  perd `rating`.

## Fichiers touchés

| Fichier                                                         | Changement                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `constants/index.tsx`                                           | + `MARKETING_CLAIMS`                                                           |
| `features/marketing/lib.ts`                                     | nouveau — seuils + `resolveSuccessRate`                                        |
| `features/marketing/dal.ts`                                     | agrégat participations + `resolveSuccessRate` ; `rating` retiré du type/retour |
| `app/(marketing)/tarifs/_components/pricing-header.tsx`         | `4.9/5` → constante                                                            |
| `app/(marketing)/a-propos/_components/about-story.tsx`          | repli → constante                                                              |
| `app/(marketing)/a-propos/_components/a-propos-page-client.tsx` | `85%` en dur → stats/constante                                                 |
| `app/(marketing)/_components/home-landing.tsx`                  | `85%`/`4.9/5` en dur → stats/constante                                         |
| `app/(marketing)/a-propos/page.tsx`                             | metadata SEO → `MARKETING_CLAIMS.successRate`                                  |
| `tests/marketing/success-rate.test.ts`                          | nouveau (unit)                                                                 |
| `tests/integration/marketing-dal.test.ts`                       | nouveau (intégration)                                                          |
| `tests/hooks/useMarketingStats.test.tsx`                        | mock sans `rating`                                                             |

## Critères d'acceptation (issues #84 + #85)

- [ ] `grep -rn "85%" app features` et `grep -rn "4.9" app features` ne matchent
      plus que la constante centralisée et ses usages importés.
- [ ] `MarketingStats` ne contient plus `rating` ; `successRate` est calculé ou
      repli éditorial documenté (le type ne ment plus).
- [ ] Le taux affiché vient du calcul SQL quand ≥ 50 participations terminées ET
      taux ≥ 70 %, sinon de la constante éditoriale.
- [ ] Une seule requête agrégée (`count(*) filter`), pas de lecture de lignes.
- [ ] Seuils (60, 50, 70) = constantes nommées et documentées.
- [ ] Aucun changement visuel ; texte FR avec accents.
- [ ] `bun run check`, `bun run test`, `bun run test:integration` passent.
