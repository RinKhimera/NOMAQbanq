import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NOMAQbanq - Préparation EACMC Partie I",
    short_name: "NOMAQbanq",
    description:
      "Plateforme francophone de préparation à l'EACMC Partie I. Plus de 5000 QCM, examens blancs et suivi de progression.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
