import { type SQL, sql } from "drizzle-orm"
import "server-only"

/**
 * Dernière utilisation (`CONTEXT.md`) : l'examen blanc le plus récent, par
 * date d'ouverture, dont le lot contient la question, désactivés compris.
 * Prédicat corrélé sur `questionId` : la question ne figure dans aucun des
 * `count` derniers examens blancs. Le tri départage par id pour que deux
 * examens ouverts le même jour gardent un rang stable.
 */
export const notUsedInLastExams = (count: number, questionId: SQL): SQL =>
  sql`not exists (
    select 1
      from exam_questions lu_q
     where lu_q.question_id = ${questionId}
       and lu_q.exam_id in (
         select lu_e.id
           from exams lu_e
          order by lu_e.start_date desc, lu_e.id desc
          limit ${count}
       )
  )`
