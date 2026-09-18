/**
 * Horloge des Server Components : l'instant du rendu descend en prop
 * (`initialNow`) pour ancrer le premier rendu client. Au scope module, hors du
 * corps de rendu (`react-hooks/purity`).
 */
export const currentTimeMs = (): number => Date.now()
