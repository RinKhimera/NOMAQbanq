# Guide de Mise à Jour du CLAUDE.md

Ce document définit les règles à suivre pour maintenir le fichier `CLAUDE.md` à la racine du projet. Consulter ce guide avant toute mise à jour.

---

## Principes Fondamentaux

### 1. Concision Absolue

- **Cible root** : < 100 lignes (actuellement ~80). Les patterns spécialisés vont dans `.claude/rules/`
- **Raison** : Le CLAUDE.md consomme du contexte. Chaque ligne inutile réduit la capacité de travail
- **Règle** : Si une info est trouvable ailleurs (package.json, schema.ts, .env.example), ne pas la dupliquer

### 2. Structure WHAT / WHY / HOW

| Section  | Contenu                                          |
| -------- | ------------------------------------------------ |
| **WHAT** | Stack, structure projet, architecture            |
| **WHY**  | Raison d'être des choix techniques, cycle de vie |
| **HOW**  | Commandes, patterns de code, workflows           |

### 3. Informations à Inclure

- Description projet en 1-2 phrases
- Stack technique (une ligne)
- Commandes essentielles (dev, build, test)
- Structure des dossiers clés (simplifiée)
- **Règles CRITIQUES** marquées avec `**IMPORTANT**`
- Patterns de code spécifiques au projet
- Gotchas et pièges connus

### 4. Informations à Exclure

| Type                      | Raison                                 |
| ------------------------- | -------------------------------------- |
| Variables d'environnement | Sécurité + redondant avec .env.example |
| Liste des dépendances     | Déjà dans package.json                 |
| Enums/types complets      | Source de vérité = schema.ts           |
| Index de base de données  | Disponible dans schema.ts              |
| Conventions génériques    | Évidentes pour un dev expérimenté      |
| Exemples de code verbeux  | Préférer références fichiers           |

### 5. Références vs Copie

**Préférer** :

```markdown
Voir `convex/lib/validation.ts:validatePostOwnership()`
```

**Éviter** :

````markdown
```typescript
// 20 lignes de code copiées
```
````

````

---

## Format des Règles Critiques

Utiliser le format suivant pour les règles qui causent des bugs si ignorées :

```markdown
**IMPORTANT - [Nom Court]** : Description concise. Voir `fichier:fonction()`.
````

Exemples :

- Ownership XOR (userId OU organizationId)
- Montants en cents
- Utiliser `_creationTime` pas `createdAt`
- Appeler `requireAdmin()` pour mutations sensibles

---

## Checklist de Mise à Jour

Avant de modifier CLAUDE.md, vérifier :

- [ ] L'info est-elle spécifique à CE projet ?
- [ ] L'info est-elle introuvable ailleurs dans le code ?
- [ ] L'info résout-elle un problème réel rencontré ?
- [ ] La formulation est-elle la plus concise possible ?
- [ ] Les références fichiers sont-elles à jour ?

---

## Quand Mettre à Jour

### Ajouter une info quand :

- Un nouveau pattern critique est introduit
- Un piège a causé un bug en session
- Une commande importante est ajoutée
- La structure du projet change significativement

### Supprimer une info quand :

- Une fonctionnalité est retirée
- L'info devient redondante
- L'info n'est plus applicable

---

## Organisation Actuelle

### Root `CLAUDE.md` (~80 lignes)

1. **Header** - Nom + description 1 ligne
2. **Stack** - Technologies (1 ligne)
3. **Commandes** - 6 commandes essentielles + CI
4. **Structure** - Arborescence simplifiée des dossiers clés
5. **Règles Critiques** - Marquées IMPORTANT (auth, queries, langue)
6. **Tests** - Seuils, config, environnements
7. **Gotchas** - Pièges et astuces universels
8. **Instruction Routing** - Table de redirection vers rules files

### `.claude/rules/` (chargés automatiquement par path)

| Fichier             | Scope                                   | Contenu                                                                         |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `convex-backend.md` | `convex/**`                             | Auth helpers, errors, rate limits, crons, HTTP actions, analytics, accès payant |
| `admin-ui.md`       | `app/(admin)/**`, `components/admin/**` | Master-detail, stat cards, filtres                                              |
| `seo.md`            | `app/(marketing)/**`, SEO files         | Metadata, pages marketing                                                       |

### Où ajouter un nouveau pattern ?

- Pattern Convex/backend → `.claude/rules/convex-backend.md`
- Pattern admin UI → `.claude/rules/admin-ui.md`
- Pattern SEO/marketing → `.claude/rules/seo.md`
- Pattern universel/gotcha → root `CLAUDE.md`
- Nouveau domaine → créer un nouveau fichier dans `.claude/rules/` avec `paths:` frontmatter

---

## Sources de Référence

- [Anthropic - Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Builder.io - Complete Guide to CLAUDE.md](https://www.builder.io/blog/claude-md-guide)
- [HumanLayer - Writing a Good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Claude Docs - Using CLAUDE.MD Files](https://claude.com/blog/using-claude-md-files)

---

## Rappel Final

> "Context is precious. Every line competes for attention."
> — Builder.io

Le CLAUDE.md n'est pas une documentation exhaustive. C'est un **aide-mémoire critique** pour éviter les erreurs récurrentes et accélérer le travail.
