# Runbook de cutover — Refonte unification sessions quiz (F1)

> **Exécuté AU DÉPLOIEMENT**, pas pendant le développement.
> Ce runbook garantit qu'aucune session d'examen en cours ne perd ses réponses lors du passage en production.

---

## Contexte — Pourquoi ce runbook est nécessaire

La refonte F1 change fondamentalement le modèle de persistance des réponses :

| Avant (F1)                                                                                    | Après (F1)                                                                                   |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Les réponses étaient stockées **dans le navigateur** (localStorage via `lib/exam-storage.ts`) | Les réponses sont persistées **en base** par question (`examAnswers`) au fil de la passation |
| `startExam` créait uniquement une `examParticipation`                                         | `startExam` **pré-crée une ligne `examAnswers` par question** (selectedAnswer null)          |
| `submitExamAnswers` calculait le score depuis les réponses envoyées en une fois               | `finalizeExam` **calcule le score en lisant les lignes `examAnswers` depuis la base**        |

**Conséquence directe pour les participations `in_progress` au moment du déploiement :**
Une participation démarrée AVANT le déploiement n'a aucune ligne `examAnswers` pré-créée (l'ancien `startExam` ne les créait pas). Quand `finalizeExam` est appelé après le déploiement, il lit `count(*) from examAnswers where participationId = …` → 0 ligne → score 0. De plus, les réponses en localStorage du navigateur sont perdues puisque le nouveau client ne les lit plus.

---

## Étape 1 — Détection : mesurer l'exposition AVANT toute migration

Exécuter cette requête sur la base de production **avant** d'appliquer la migration Drizzle :

```sql
select count(*) from exam_participations where status = 'in_progress';
```

- Si le résultat est **0** : la fenêtre de déploiement est sûre, passer à l'étape 3 directement.
- Si le résultat est **> 0** : des sessions sont actives, appliquer la stratégie de drainage (étape 2).

---

## Étape 2 — Drainage des participations `in_progress`

### Option A — Attendre une fenêtre sans examen actif (recommandé)

Les examens blancs ont une `startDate` et une `endDate`. Si tous les examens actifs se terminent avant la fenêtre de déploiement, re-vérifier avec la requête de l'étape 1 jusqu'à obtenir 0.

### Option B — Auto-soumission d'urgence (si fenêtre sans examen impossible)

Script SQL d'auto-soumission : calcule le score depuis les lignes `examAnswers` existantes (les réponses saisies dans le navigateur ne sont PAS récupérables, mais au moins la participation est clôturée proprement au lieu de scorer 0 à la soumission post-déploiement).

```sql
-- 1. Calculer et persister le score depuis les réponses existantes en base
--    (peut être 0 si l'utilisateur n'avait rien saisi via l'ancienne API,
--    ou partiel si certaines réponses étaient déjà en base par un autre chemin).
with scores as (
  select
    ep.id as participation_id,
    count(*) filter (where ea.is_correct = true)::integer as correct_count,
    count(*)::integer                                       as total_count
  from exam_participations ep
  left join exam_answers ea on ea.participation_id = ep.id
  where ep.status = 'in_progress'
  group by ep.id
)
update exam_participations ep
set
  status       = 'auto_submitted',
  score        = case
                   when s.total_count > 0
                   then round((s.correct_count::numeric / s.total_count) * 100)::integer
                   else 0
                 end,
  completed_at = now()
from scores s
where ep.id = s.participation_id
  and ep.status = 'in_progress';

-- 2. Vérifier que le drainage est complet
select count(*) from exam_participations where status = 'in_progress';
-- Doit retourner 0 avant de continuer.
```

> **Note :** en production, les réponses de ces participations héritées n'étaient stockées que dans le localStorage du navigateur — elles ne sont pas récupérables côté serveur. Le score auto-soumis sera donc 0 (ou partiel si des lignes `examAnswers` existaient déjà). Communiquer à ces utilisateurs qu'ils pourront repasser l'examen si leur fenêtre est encore ouverte.

---

## Étape 3 — Appliquer la migration Drizzle

Une fois que `select count(*) from exam_participations where status = 'in_progress'` retourne **0** :

```bash
bun run db:migrate
```

Cette migration applique (tâche A1 du plan) :

- `CREATE TYPE training_mode AS ENUM ('tutor', 'test')`
- `ALTER TABLE training_sessions ADD COLUMN mode training_mode NOT NULL DEFAULT 'test'`
- `ALTER TABLE exam_answers ALTER COLUMN selected_answer DROP NOT NULL`
- `ALTER TABLE exam_answers ALTER COLUMN is_correct DROP NOT NULL`
- `ALTER TABLE exam_participations DROP COLUMN pause_phase`
- `ALTER TABLE exam_participations DROP COLUMN pause_ended_at`
- `ALTER TABLE exam_participations DROP COLUMN is_pause_cut_short`

---

## Étape 4 — Déployer le code

Déployer la branche `feat/refonte-quiz-audience-images` en production (Vercel ou autre). Le déploiement active :

- `startExam` avec pré-création des lignes `examAnswers`
- `finalizeExam` avec calcul de score depuis la base
- `pauseExam` / `resumeExam` (modèle de repos simplifié, une seule pause plafonnée)
- `<QuizRunner>` unifié (examen + entraînement)
- Mode tuteur / mode test pour l'entraînement

---

## Vérification post-déploiement

```sql
-- Aucune participation bloquée en in_progress depuis plus de la durée max d'un examen
select count(*)
from exam_participations ep
join exams e on e.id = ep.exam_id
where ep.status = 'in_progress'
  and ep.started_at < now() - (e.completion_time || ' seconds')::interval;
-- Doit retourner 0.

-- Les nouvelles sessions pré-créent bien les lignes examAnswers
select ep.id, count(ea.id) as answer_rows
from exam_participations ep
left join exam_answers ea on ea.participation_id = ep.id
where ep.status = 'in_progress'
  and ep.started_at > now() - interval '1 hour'
group by ep.id;
-- Toutes les lignes doivent avoir answer_rows > 0.
```

---

## Récapitulatif de l'ordre d'opération

```
1. Requête de détection (status='in_progress' count)
        ↓ si 0 → sauter l'étape 2
2. Drainage (attente fenêtre sans examen OU auto-soumission SQL)
        ↓ re-vérifier count = 0
3. bun run db:migrate
        ↓
4. Déploiement du code (Vercel)
        ↓
5. Vérification post-déploiement
```
