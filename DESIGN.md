# DESIGN.md — NOMAQbanq

> Référence de design **permanente** du produit. À placer à la racine du dépôt, à côté de `CLAUDE.md` / `README.md`.
> Tout agent (Claude Code ou autre) et tout développeur lit ce fichier **avant** de créer ou modifier une interface.
> Il décrit _comment l'interface doit être_ ; _quoi construire maintenant_ se lit dans la **maquette en ligne**, projet Claude Design « Refonte vitrine NOMAQbanq » (`fd197391-79cf-4028-9ad0-dbbdeeadfdf1`), fichiers à la racine du projet, via l'outil `DesignSync` (`get_file`). C'est la seule source à jour. Toute copie téléchargée (`design_handoff_refonte/`, y compris le sous-dossier du même nom dans le projet en ligne) est antérieure aux révisions : ne pas la suivre. Sans accès à `DesignSync`, s'arrêter et le signaler plutôt qu'implémenter depuis le texte d'une issue.

Design system : **NOMAQbanq v2 « Manuel »**, direction A — éditorial académique et clinique.

---

## 1. Principes (non négociables)

1. **Le contenu médical est le héros.** Vignettes cliniques en serif, chiffres en mono, interface discrète autour.
2. **Filets plutôt qu'ombres.** La structure se fait avec des bordures de 1 px. Une ombre seulement pour ce qui flotte (dialogue, menu, popover, toast).
3. **Une seule couleur d'action : le bleu `#2563eb`, en aplat.** Une seule action primaire par zone.
4. **La couleur a un sens.** Émeraude = correct / entraînement. Rouge = incorrect / critique. Ambre = marqué / expiration / attention. Violet = objectifs du CMC. Orange = zone admin (navigation seulement).
5. **Aucun effet décoratif.** Interdits : dégradés (sauf logo), verre dépoli, orbes, soulèvement au survol, `scale` sur les boutons, emoji, tuiles d'icônes colorées.

## 2. Jetons

Définis dans `app/globals.css` (palette brute, sémantique clair/sombre ; source : `prototypes/_ds/…/tokens/*.css` du handoff). **Toujours** utiliser les jetons sémantiques (`--ink`, `--line`…), jamais la palette brute dans les composants.

### Couleurs sémantiques

| Jeton                                    | Clair                                         | Sombre    | Usage                                                            |
| ---------------------------------------- | --------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `--bg`                                   | `#fbfbfa`                                     | `#0a1122` | fond de page (papier / marine)                                   |
| `--surface`                              | `#ffffff`                                     | `#0f1a31` | cartes, tableaux, champs                                         |
| `--surface-2`                            | `#f4f3f0`                                     | `#14213d` | fonds secondaires, pistes de barres, survol                      |
| `--ink`                                  | `#0f172a`                                     | `#e6ebf5` | texte principal                                                  |
| `--ink-2`                                | `#3f4a5c`                                     | `#b4bfd4` | texte courant secondaire                                         |
| `--ink-3`                                | `#5b6678`                                     | `#8b98b3` | libellés, métadonnées (≥ 4,5:1)                                  |
| `--ink-4`                                | `#94a3b8`                                     | —         | **décoratif / désactivé uniquement**, jamais de texte informatif |
| `--line`                                 | `#e6e4df`                                     | `#1f2c47` | filets                                                           |
| `--line-strong`                          | `#d6d3cc`                                     | `#2d3d5e` | bordures de contrôles                                            |
| `--accent`                               | `#2563eb`                                     | `#2563eb` | action primaire, focus, sélection                                |
| `--accent-hover` / `--accent-ink`        | `#1d4ed8`                                     |           | survol / texte d'accent                                          |
| `--accent-soft`                          | `#eef3fe`                                     |           | fond d'élément sélectionné                                       |
| `--success` / `-ink` / `-soft` / `-line` | `#059669` / `#047857` / `#ecfdf5` / `#a7f3d0` |           | correct, réussi, actif                                           |
| `--danger` …                             | `#dc2626` / `#b91c1c` / `#fef2f2` / `#fecaca` |           | incorrect, échec, suppression                                    |
| `--warning` …                            | `#d97706` / `#b45309` / `#fffbeb` / `#fde68a` |           | marqué, expire bientôt, à vérifier                               |
| `--admin` / `-ink` / `-soft`             | `#ea580c` / `#c2410c` / `#fff7ed`             |           | accent de navigation admin                                       |
| `--objective`                            | `#7c3aed`                                     |           | objectifs du CMC                                                 |
| `--pattern-dot`                          | `#c9d2df`                                     |           | trame de points                                                  |
| `--focus-ring`                           | `0 0 0 3px rgb(37 99 235 / .28)`              |           | anneau de focus                                                  |

Thème sombre : classe `.dark` sur `<html>`, posée par next-themes. Thème du système par défaut ; bascule Clair / Sombre / Système mémorisée (`localStorage`).

### Typographie

| Rôle                   | Police         | Taille / interligne    | Graisse |
| ---------------------- | -------------- | ---------------------- | ------- |
| display                | Source Serif 4 | 64 / 1.02, −0.02em     | 600     |
| h1                     | Source Serif 4 | 44 / 1.08, −0.02em     | 600     |
| h2                     | Source Serif 4 | 32 / 1.15, −0.015em    | 600     |
| h3                     | Source Serif 4 | 24 / 1.25, −0.01em     | 600     |
| h4                     | IBM Plex Sans  | 18 / 1.35              | 600     |
| vignette clinique      | Source Serif 4 | 18 / 1.65              | 400     |
| body-lg / body / small | IBM Plex Sans  | 18·16·14 / 1.6·1.6·1.5 | 400     |
| label                  | IBM Plex Mono  | 12, +0.06em, CAPITALES | 500     |
| chiffres, chrono, ID   | IBM Plex Mono  | selon contexte         | 400–500 |

L'échelle se réduit sous 1024 et 768 px. Grands chiffres de tableau de bord : Source Serif 4 600, 26–30 px.

### Espacement, formes, mouvement

- Espacement : 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 px (`--space-*`). Sections : 96 px. Conteneur : 1152 px, marge 24 px.
- Contrôles : **32 / 40 / 48 px**. Dans une barre de filtres, **tous les contrôles font 40 px**.
- Rayons : 2 px badges · 3 px lettres A–E · 4 px contrôles · 6 px cartes et dialogues. Pilule uniquement pour avatar, switch, compteur.
- Ombres : `--shadow-1` cartes, `--shadow-pop` éléments flottants.
- Mouvement : 120 / 180 / 260 ms, `cubic-bezier(.2,0,0,1)`. Survol = changement de fond ou de bordure, **jamais** de translation ni d'échelle.

### Points de rupture

640 · 768 · 1024 · 1280 px. Sous 1024 : la navigation latérale passe dans un panneau (Sheet) ouvert depuis la barre du haut ; le navigateur de questions aussi. Sous 768 : grilles en une colonne. Cibles tactiles **44 px** minimum sur mobile. Tableaux : défilement horizontal dans leur carte, jamais de la page.

## 3. Fonds

- **Papier** (`--bg`) partout par défaut.
- **Trame de points** (`.nq-bg-dots`, `.nq-bg-dots-fade`) : héros, panneau de marque, connexion. Points `--pattern-dot`, grille 22 px, fondu.
- **Marine** : bande CTA, panneau de connexion = une section `.dark`, pas un dégradé.
- Une photo par page au maximum (rayon 6, filet 1 px, sans ombre). Sur l'accueil, une vraie carte de question remplace la photo.

## 4. Iconographie

Lucide uniquement, trait 1.75, 14–18 px, couleur `--ink-3` ou sémantique. Une icône n'accompagne un titre que si elle aide à scanner.

## 5. Contenu et ton

- Français **fr-CA**, **vouvoiement**, accents obligatoires. Espace insécable avant « ! ? : ; » et dans « Partie I », « 85 % ».
- Ton de coach sobre : **aucun superlatif** (« #1 », « révolutionnaire », « SANS LIMITES »). Les chiffres suffisent.
- Casse de phrase partout ; capitales réservées aux libellés mono.
- Unités compactes en mono : « 42j restants », « Question 12 / 50 », « 01:24:36 », « 5 h 18 ».
- Montants : « 350 $ » pour un montant rond, « 49,50 $ » avec des cents (jamais « 49,5 $ »), « 65 000 XAF ». Dates : « 21 sept. 2026 » ; heures « 16 h 42 » ; fuseau « heure de l'Est » pour les examens.

### Chiffres publics (source unique)

| Affiché          | Réalité                          | Règle                                    |
| ---------------- | -------------------------------- | ---------------------------------------- |
| 3000+ QCM        | 2 880                            | arrondi du code, ne pas écrire « 5000+ » |
| 22 domaines      | 22                               | jamais « 23 »                            |
| 300+ candidats   | 232 comptes                      | arrondi du code                          |
| 85 % de réussite | constante éditoriale             |                                          |
| 4,9/5            | constante (aucun système d'avis) |                                          |

**Ne jamais afficher publiquement le nombre de questions par domaine** (réservé à l'admin).

### Règles métier affichées

- Seuil de réussite : **60 %**. Couleurs de score : ≥ 80 vert, ≥ 60 ambre, < 60 rouge.
- Examen blanc : 230 q, 318 min (83 s/q), **une** pause (45 min), **une** tentative, chronomètre continu même page fermée, soumission automatique à 0, résultats publiés **à la fermeture**.
- Entraînement : 5–20 q, modes **Test** (défaut) et **Tuteur**, sans chronomètre, une série en cours (expire en 24 h).
- Prix : 50 $ / 200 $ par accès (1 / 6 mois), Pack Premium 350 $ (6 mois, les deux accès, non cumulable). Le temps d'un accès simple se cumule en prolongeant.

## 6. Composants

Base : composants du design system des maquettes, portés sur les primitives `components/ui/*` du dépôt. Le catalogue des composants partagés (primitives et composites, existants et à venir) vit dans `.claude/rules/design-system.md` : le consulter avant de créer.

- **core** : Button (primary / secondary / ghost / danger ; sm 32 · md 40 · lg 48 ; icon, icon-sm), Badge, Icon, Logo. Une carte et un filet s'écrivent en jetons (`bg-surface border-line rounded-lg`, `border-line`), sans primitive
- **forms** : Input, Textarea, Field (label, hint, error), Checkbox, Switch, RadioGroup, Select, SearchInput (raccourci « / »), FilterChip, Slider
- **feedback** : Alert, Toast, Progress, Spinner, Skeleton, EmptyState
- **navigation** : onglets (segmentés = `SegmentedControl` ; à panneaux = aucune primitive, à créer avec le premier écran), ToggleGroup, SideNav (`admin` = accent orange), Pagination, Breadcrumb, Stepper
- **overlay** : Dialog, Sheet, DropdownMenu, Popover, Tooltip
- **data** : Avatar, Table (`dense` en admin), Accordion
- **quiz** : QuestionCard, AnswerOption (lettres A–E), SessionHeader, QuestionNavigator, Calculator, LabValues
- **dashboard** : VitalCard, ProgressRing, AccessBadge, BarChart, LineChart — ⚠️ **BarChart/LineChart = scores 0–100 uniquement**
- **admin** : AdminBar (bandeau « Mode administration », **fond opaque**), StatusBadge, ChoiceEditor

### Ajouts de la refonte (prototypés dans `Design-system-ajouts.html` du handoff, hors dépôt ; catalogue dans `.claude/rules/design-system.md`)

| Composant                           | Rôle                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `ValueBarChart`                     | barres pour montants/nombres, échelle = max, valeur réelle affichée                |
| `ColumnChart`                       | série temporelle de montants, légende « max »                                      |
| `ActionQueue`                       | file « À traiter » ; lignes à 0 masquées ; vide → « Rien à traiter · vérifié à … » |
| `StatBand`                          | bande de 2–4 chiffres clés séparés par des filets (serif + contexte mono)          |
| `FilterPanelButton` + `FilterGroup` | bouton « Filtres » avec compteur ; groupes à options de largeur égale              |
| `ColumnsMenu`                       | afficher/masquer des colonnes, mémorisé                                            |
| `SortHeader`                        | tri dans l'en-tête de colonne (hérite capitales/espacement du `th`)                |
| `StepTitle`                         | « 01 Titre » sur une ligne pour les formulaires en étapes                          |
| `SummaryPanel`                      | récapitulatif fixe à droite portant l'action primaire                              |
| Centre de notifications             | cloche + point bleu + panneau (proposé, n'existe pas encore)                       |

## 7. Modèles d'écran

- **Barre de filtres** : files fréquentes → onglets (avec compteurs) ; sur la ligne : recherche + 1–2 filtres principaux + « Filtres » (panneau) + « Colonnes » à droite ; filtres actifs en pastilles + « Tout effacer » ; tri dans les en-têtes ; pagination (pas de « charger plus », pas de défilement infini).
- **Formulaire en étapes** : une Card par étape avec `StepTitle` ; colonne droite `nq-sticky` avec récapitulatif/vérifications + action primaire ; sous 1024 px, la colonne passe dessous.
- **Carte de question** : explication et références **repliables**, seulement en correction (résultats, mode tuteur). Jamais sur l'accueil ni les pages domaines.
- **États** : chaque page a chargement (Skeleton qui reprend la mise en page), erreur (« Impossible de charger vos données » + « Réessayer »), vide (message + action).
- **Admin** : AdminBar en haut (opaque), SideNav orange, actions primaires bleues, tableaux denses, ID et chiffres en mono, statuts via StatusBadge.

## 8. À ne pas faire

- Pas de bannière de cookies (cookies essentiels uniquement).
- Pas de nombre de questions par domaine côté public.
- Pas de « taxes incluses » tant que Stripe ne calcule pas de taxes.
- Pas de graphique 0–100 pour des montants.
- Pas de contrôles de hauteurs différentes dans une même barre.
