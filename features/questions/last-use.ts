import { type SQL, sql } from "drizzle-orm"
import "server-only"

/**
 * Dernière utilisation (`CONTEXT.md`) : l'examen blanc le plus récent, par
 * date d'ouverture, dont le lot contient la question, désactivés compris et
 * examens en préparation exclus (leur jeu n'est pas fixé).
 * Prédicat corrélé sur `questionId` : la question ne figure dans aucun des
 * `count` derniers examens blancs. Le tri départage par id pour que deux
 * examens ouverts le même jour gardent un rang stable. `exceptExamId` :
 * l'examen qu'on compose ne compte pas, même finalisé (voir `getLastUses`).
 */
export const notUsedInLastExams = (
  count: number,
  questionId: SQL,
  exceptExamId?: string,
): SQL =>
  sql`not exists (
    select 1
      from exam_questions lu_q
     where lu_q.question_id = ${questionId}
       and lu_q.exam_id in (
         select lu_e.id
           from exams lu_e
          where lu_e.finalized_at is not null
            ${exceptExamId ? sql`and lu_e.id <> ${exceptExamId}` : sql``}
          order by lu_e.start_date desc, lu_e.id desc
          limit ${count}
       )
  )`
