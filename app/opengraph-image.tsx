import { NBSP, OG_SIZE, ogCard } from "@/lib/og-card"

export const alt = "NOMAQbanq, préparation à l'EACMC Partie I"
export const size = OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return ogCard({ title: `Préparez l'EACMC Partie${NBSP}I en français` })
}
