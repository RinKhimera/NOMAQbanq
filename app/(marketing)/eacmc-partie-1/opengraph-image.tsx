import { NBSP, ogCard } from "@/lib/og-card"
import { OG_SIZE } from "@/lib/seo"

export const alt =
  "Guide de l'EACMC en français : format, inscription et préparation"
export const size = OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return ogCard(`L'EACMC, anciennement Partie${NBSP}I : le guide`)
}
