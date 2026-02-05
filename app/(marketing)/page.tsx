import { Metadata } from "next"
import HomeLanding from "./_components/home-landing"

export const metadata: Metadata = {
  title: "Préparation EACMC Partie I - 5000+ QCM francophones",
  description:
    "NOMAQbanq : la première plateforme francophone pour préparer l'EACMC Partie I. Plus de 5000 QCM, examens blancs, modes tuteur et chronomètre. Rejoignez des milliers de candidats satisfaits.",
  alternates: {
    canonical: "https://nomaqbanq.ca",
    languages: {
      "fr-CA": "https://nomaqbanq.ca",
    },
  },
  openGraph: {
    title: "NOMAQbanq - Préparation EACMC Partie I",
    description:
      "Première plateforme francophone de préparation à l'EACMC. Plus de 5000 QCM, examens blancs et suivi de progression pour réussir votre examen.",
    images: [
      {
        url: "/images/home-image.jpg",
        width: 1200,
        height: 630,
        alt: "NOMAQbanq - Plateforme de préparation EACMC",
      },
    ],
  },
}

export default function Home() {
  return <HomeLanding />
}
