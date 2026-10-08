// Mapping centralisé des erreurs Better Auth (client) → messages FR.
// `error.code` est la clé UPPER_SNAKE renvoyée par le client ; `error.status`
// porte le code HTTP (429 sur rate-limit). Le `kind` pilote l'UI des forms.

export type AuthErrorKind =
  "invalid_credentials" | "email_not_verified" | "banned" | "generic"

export interface MappedAuthError {
  kind: AuthErrorKind
  message: string
}

interface AuthErrorInput {
  code?: string
  message?: string
  status?: number
}

const GENERIC = "Une erreur est survenue. Veuillez réessayer."

export function mapAuthError(
  error: AuthErrorInput | null | undefined,
): MappedAuthError {
  const code = error?.code
  const status = error?.status

  if (code === "EMAIL_NOT_VERIFIED") {
    return {
      kind: "email_not_verified",
      message: "Votre compte n'est pas encore activé.",
    }
  }

  if (code === "BANNED_USER") {
    return { kind: "banned", message: "Ce compte est suspendu." }
  }

  // Better Auth refuse un mot de passe trop long avant même de chercher le
  // compte : aucun compte ne peut en avoir un (plafond de l'inscription), donc
  // c'est une faute de frappe, pas une autre erreur.
  if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "PASSWORD_TOO_LONG") {
    return {
      kind: "invalid_credentials",
      message: "Courriel ou mot de passe incorrect.",
    }
  }

  if (status === 429 || code === "TOO_MANY_REQUESTS") {
    return {
      kind: "generic",
      message: "Trop de tentatives. Veuillez réessayer dans une minute.",
    }
  }

  if (
    code === "USER_ALREADY_EXISTS" ||
    code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  ) {
    return {
      kind: "generic",
      message:
        "Un compte existe déjà avec cette adresse. Essayez de vous connecter, ou de réinitialiser votre mot de passe.",
    }
  }

  return { kind: "generic", message: GENERIC }
}
