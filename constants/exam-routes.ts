// Module pur : les liens des examens blancs (pages serveur et clients).

export const EXAMS_HREF = "/admin/examens"

/** Liste des examens blancs de l'étudiant. */
export const STUDENT_EXAMS_HREF = "/tableau-de-bord/examen-blanc"

export const examHref = (examId: string) => `${EXAMS_HREF}/${examId}`

export const examEditHref = (examId: string) =>
  `${EXAMS_HREF}/modifier/${examId}`

/** Le formulaire, défilé jusqu'à son étape Audience. */
export const examAudienceEditHref = (examId: string) =>
  `${examEditHref(examId)}#audience`

/** Écran d'où l'on ouvre le compositeur, et où son « Terminé » ramène. */
export type ComposerReturn = "fiche" | "formulaire"

/** Compositeur ; `back` fixe où ramène son « Terminé ». */
export const examComposerHref = (examId: string, back: ComposerReturn) =>
  `${examHref(examId)}/questions?retour=${back}`

/** Où ramène le « Terminé » du compositeur. */
export const composerReturnHref = (examId: string, back: ComposerReturn) =>
  back === "fiche" ? examHref(examId) : examEditHref(examId)

/** Création, ou réouverture d'un examen clos (`?source=`). */
export const examCreateHref = (sourceId?: string) =>
  sourceId ? `${EXAMS_HREF}/creer?source=${sourceId}` : `${EXAMS_HREF}/creer`

/** Copie d'un participant. */
export const examCopyHref = (examId: string, userId: string) =>
  `${examHref(examId)}/resultats/${userId}`
