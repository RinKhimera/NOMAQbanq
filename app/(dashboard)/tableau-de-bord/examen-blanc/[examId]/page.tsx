import { redirect } from "next/navigation"

/**
 * Plus de page propre à un examen côté étudiant : la liste porte ses états,
 * `/resultats` sa correction. Une ancienne URL ramène à la liste.
 */
export default function StudentExamPage() {
  redirect("/tableau-de-bord/examen-blanc")
}
