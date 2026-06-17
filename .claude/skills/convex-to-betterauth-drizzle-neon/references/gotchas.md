# Gotchas transverses (durement gagnés)

Pièges réels rencontrés sur la stack cible. Les gotchas spécifiques à Better Auth sont dans `02`.

## Drizzle / Neon

- **`neon-http` ne supporte pas les transactions multi-statements.** Pour des écritures atomiques,
  utiliser un client `pg` (Pool) + `drizzle-orm/node-postgres` (`dbTx`). Voir `01`.
- **Glob de schéma récursif** : `./db/schema/**/*.ts` dans `drizzle.config.ts`, **pas**
  `./db/schema/*` — sinon les sous-dossiers de domaines sont invisibles à drizzle-kit.
- **`drizzle.config.ts` doit charger `.env.local` explicitement** (`dotenv` :
  `config({ path: '.env.local' })`). `dotenv/config` ne lit que `.env`. Symptôme : `url: undefined`
  au `db:migrate`.
- **Migrations = URL non-pooled** (`DATABASE_URL_UNPOOLED`). La pooled casse les migrations.
- **Type-change destructif sur enum Postgres** : passer une colonne `text` → `pgEnum` exige un
  `USING col::mon_enum` et **plante si des valeurs invalides existent**. Inspecter le SQL généré
  avant `db:migrate` en prod (fréquent en migrant des `v.union` Convex laxistes).
- **Sous-requête corrélée Drizzle non qualifiée** en select mono-table : `sql\`${parent.id}\``rend`"id"`sans le préfixe de table →`integer = text`à l'exécution. Compter via une requête`count()`
  dédiée plutôt qu'une sous-requête non qualifiée.

## Next.js / Server Actions

- **`'use server'` : chaque export doit être une fonction `async` _littérale_.** Une arrow qui
  _renvoie_ une promesse sans `async` passe `tsc`/`eslint` mais **casse au build**
  (« Server Actions must be async functions »).
- **`serverActions.bodySizeLimit`** = 1 Mo par défaut → un upload FormData plus lourd échoue **avant**
  l'action. Relever dans `next.config.ts` ; **non pris en HMR** (redémarrer le dev server).
- **`revalidateTag(tag, 'max')`** : 2ᵉ argument requis en Next 16.
- **`cookies()` / `headers()` / `params` / `searchParams` async** (Next ≥ 15) : toujours `await`.
- **`config.matcher` du proxy** = chaîne littérale plain, **jamais** `String.raw` — sinon le matcher
  s'applique à `/_next/static/*` et casse le CSS.
- **Diagnostic Server Action opaque** : logguer en dev (`process.env.NODE_ENV !== 'production'`) les
  `formData.entries()` en début d'action et `error.message` dans le catch (propagé en `formError`).
- **`react-hooks/set-state-in-effect`** (si activé en error) interdit un `setState` synchrone dans un
  `useEffect`. Pour un dialog + Server Action, appeler l'action **inline** dans `startTransition` au
  lieu de `useActionState` + effet. Voir `04`, pattern B.

## i18n (si le projet utilise next-intl)

- **`NextIntlClientProvider` requiert `messages`** : sans la prop `messages`, tout Client Component
  utilisant un hook next-intl jette « No intl context found ». Charger via `getMessages()` dans le
  layout et passer en prop.
- **`redirect()` next-intl + narrowing TS** : retourne `never` mais TS ne narrow pas toujours.
  Pattern défensif : `if (x) return x; redirect(...); throw new Error('unreachable');`.

## Seed / scripts Bun

- **Scripts Bun hors Next ne résolvent pas la condition `react-server`** → un `import 'server-only'`
  dans `db/index.ts` ferait throw. Garder `server-only` dans la DAL, pas dans le client DB (ou lancer
  les scripts avec `--conditions react-server`).
- **Wipe de données et FK** : ne jamais `TRUNCATE ... CASCADE` une table référencée par d'autres
  sans réfléchir aux FK. Préférer des `DELETE` ordonnés (enfants avant parents) + détacher les FK
  optionnelles (`UPDATE ... SET fk = NULL`) avant de supprimer les parents.
