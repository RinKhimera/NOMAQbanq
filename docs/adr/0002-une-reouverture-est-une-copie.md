---
status: accepted
date: 2026-09-28
---

# Une réouverture est une copie

Pour offrir de nouveau un examen blanc clos, les admins repoussaient sa date
de fin. Les participations de l'édition précédente restaient attachées à
l'examen redevenu ouvert : le verrou de clé de réponse retenait la correction
de leurs autres examens partageant des questions, leurs anciens résultats
redevenaient illisibles, et l'unicité (examen, étudiant) leur interdisait de
repasser. Un admin, jamais sous verrou, ne voyait rien.

Nous décidons qu'une **réouverture** (`CONTEXT.md`) crée un nouvel examen
blanc : l'action « Rouvrir » ouvre le formulaire de création pré-rempli depuis
l'examen source, dates vides, et la création existante l'enregistre. L'examen
d'origine garde ses participations, ses scores et son classement. En
contrepartie, `updateExam` refuse de repousser dans le futur la fin d'un examen
clos qui a des participations (`REOPEN_BY_DATES`) ; prolonger un examen encore
ouvert, reprogrammer un examen clos sans participation ou corriger sa fin vers
une autre date passée restent permis.

## Options écartées

- **Éditions d'un même examen** (participations rattachées à une édition).
  Toutes les lectures par examen — verrou de clé, résultats, classement,
  percentile, statistiques — seraient à réécrire pour distinguer l'édition.
- **Archiver les anciennes participations** en les marquant sur l'examen
  rouvert. Chaque lecture doit alors filtrer les archivées ; un oubli recrée le
  bug en silence, sans que rien ne casse à la compilation.

## Conséquences

- L'identité d'une épreuve rouverte n'est pas modélisée : aucun lien
  source → copie n'est stocké. Rapprocher deux passages d'un même étudiant sur
  « la même épreuve » passe par le titre ou le jeu de questions.
- Un étudiant peut avoir une participation à chacun des deux examens ; les
  deux comptent dans ses statistiques, et le classement de la copie ne compte
  que ses propres participations.
- Les réouvertures faites par les dates avant cette règle ont été reprises en
  base (13 copies archivées, issue #250).
