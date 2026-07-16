import type { Metadata } from "next"

// La page est un composant client : le titre vit dans ce layout de segment.
export const metadata: Metadata = { title: "Réinitialiser le mot de passe" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
