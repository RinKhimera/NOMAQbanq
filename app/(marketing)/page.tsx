import { Metadata } from "next"
import HomeLanding from "./_components/home-landing"

export const metadata: Metadata = {
  title: "Accueil",
  description:
    "NOMAQbanq : la première plateforme francophone pour préparer l'EACMC Partie I. Plus de 5000 QCM, examens blancs, modes tuteur et chronomètre. Rejoignez des milliers de candidats satisfaits.",
  alternates: {
    canonical: "https://nomaqbanq.ca",
  },
}

export default function Home() {
  return <HomeLanding />
}
