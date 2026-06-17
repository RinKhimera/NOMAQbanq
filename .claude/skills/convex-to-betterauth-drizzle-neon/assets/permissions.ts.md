# Gabarit → `lib/permissions.ts`

Access Control typé fusionné avec les `defaultStatements` du plugin admin, puis des rôles. Trimé à un
exemple `user`/`admin` avec 2 ressources — le projet source en avait 16. Étends à tes ressources.

```ts
import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access';

// ADAPT: une entrée par ressource métier, avec ses actions.
export const statement = {
  ...defaultStatements, // statements du plugin admin (user, session…)
  post: ['create', 'read', 'update', 'delete', 'moderate'],
  comment: ['create', 'read', 'delete'],
} as const;

export const ac = createAccessControl(statement);

export const user = ac.newRole({
  post: ['create', 'read', 'update', 'delete'],
  comment: ['create', 'read', 'delete'],
});

export const admin = ac.newRole({
  ...adminAc.statements, // toutes les capacités admin par défaut
  post: ['create', 'read', 'update', 'delete', 'moderate'],
  comment: ['create', 'read', 'delete'],
});

export const roles = { user, admin } as const;

export type AppRole = keyof typeof roles;
```

> ⚠️ Ces `roles` + `ac` doivent être passés à `adminPlugin({ ac, roles, ... })` dans `lib/auth.ts`
> (voir `auth.ts.md`). Les clés de `roles` doivent matcher les valeurs de `userRoleEnum`
> (`schema-auth.ts.md`).
