// Module pur : les liens des écrans d'examen admin (pages serveur et clients).

export const examHref = (examId: string) => `/admin/examens/${examId}`

export const examEditHref = (examId: string) =>
  `/admin/examens/modifier/${examId}`

/** Le formulaire, défilé jusqu'à son étape Audience. */
export const examAudienceEditHref = (examId: string) =>
  `${examEditHref(examId)}#audience`

/** Compositeur ; `back` fixe où ramène son « Terminé ». */
export const examComposerHref = (
  examId: string,
  back: "fiche" | "formulaire",
) => `/admin/examens/${examId}/questions?retour=${back}`
