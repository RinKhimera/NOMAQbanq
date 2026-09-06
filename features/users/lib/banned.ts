// Les callbacks de Better Auth reçoivent le `User` du cœur, dont le type ignore
// les champs du plugin admin ; à l'exécution l'objet vient de la base et porte
// `banned`. Seul endroit où ce champ est lu par cast.
export const isBannedUser = (user: object): boolean =>
  (user as { banned?: boolean | null }).banned === true
