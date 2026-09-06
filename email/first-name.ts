/** Premier mot non vide du nom complet, ou null : sert de salutation. */
export function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0]
  return first ? first : null
}
