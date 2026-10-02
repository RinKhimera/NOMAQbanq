import { redirect } from "next/navigation"
import { STUDENT_EXAMS_HREF } from "@/constants/exam-routes"

/**
 * Un examen n'a pas de page propre côté étudiant : la liste porte ses états,
 * `/resultats` sa correction et son percentile. Ce segment ne sert que ses
 * enfants ; son URL nue ramène à la liste.
 */
export default function StudentExamPage() {
  redirect(STUDENT_EXAMS_HREF)
}
