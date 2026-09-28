const LABELS: Record<string, string> = {
  production: "Production",
  preview: "Prévisualisation",
  development: "Développement",
}

/** Vercel pose `VERCEL_ENV` sur ses déploiements ; `bun dev` ne l'a pas. */
export const deploymentEnvLabel = (vercelEnv: string | undefined): string => {
  const value = vercelEnv ?? "development"
  return LABELS[value] ?? value
}
