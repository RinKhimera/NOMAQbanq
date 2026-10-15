import { NBSP, ogCard } from "@/lib/og-card"
import { OG_SIZE, SITE_OG_ALT } from "@/lib/seo"

export const alt = SITE_OG_ALT
export const size = OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return ogCard(`Préparez l'EACMC Partie${NBSP}I en français`)
}
