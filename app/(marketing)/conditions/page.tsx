import { Metadata } from "next"
import { CtaBand } from "@/components/marketing/cta-band"
import {
  type LegalArticle,
  LegalDocument,
} from "@/components/shared/legal-document"

export const metadata: Metadata = {
  title: "Conditions d'utilisation | NOMAQbanq",
  description:
    "Conditions générales d'utilisation de la plateforme NOMAQbanq pour la préparation à l'EACMC Partie I.",
  alternates: {
    canonical: "https://nomaqbanq.ca/conditions",
  },
}

const ARTICLES: LegalArticle[] = [
  {
    id: "objet",
    title: "Objet et acceptation des conditions",
    blocks: [
      "Les présentes conditions générales d'utilisation régissent l'accès et l'utilisation de la plateforme NOMAQbanq. En accédant à nos services, vous acceptez d'être lié par ces conditions.",
      "L'utilisation de la plateforme implique l'acceptation pleine et entière des présentes conditions. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.",
    ],
  },
  {
    id: "services",
    title: "Description des services",
    blocks: [
      "NOMAQbanq est une plateforme francophone de préparation à l'examen EACMC Partie I (Examen d'aptitude du Conseil médical du Canada). Nos services comprennent :",
      {
        list: [
          "Accès à une banque de plus de 3000 questions à choix multiples",
          "Examens blancs simulant les conditions réelles de l'examen",
          "Suivi personnalisé de votre progression",
          "Explications détaillées pour chaque question",
        ],
      },
    ],
  },
  {
    id: "compte",
    title: "Création et gestion du compte",
    blocks: [
      "Pour accéder à nos services, vous devez créer un compte utilisateur. Vous êtes responsable de :",
      {
        list: [
          "Fournir des informations exactes et à jour lors de l'inscription",
          "Maintenir la confidentialité de vos identifiants de connexion",
          "Signaler immédiatement toute utilisation non autorisée de votre compte",
          "Toutes les activités effectuées depuis votre compte",
        ],
      },
    ],
  },
  {
    id: "obligations",
    title: "Obligations de l'utilisateur",
    blocks: [
      "En utilisant NOMAQbanq, vous vous engagez à :",
      {
        list: [
          "Utiliser la plateforme uniquement à des fins personnelles et éducatives",
          "Ne pas partager votre compte avec d'autres personnes",
          "Ne pas reproduire, distribuer ou commercialiser le contenu de la plateforme",
          "Respecter les droits de propriété intellectuelle",
          "Ne pas tenter de contourner les mesures de sécurité de la plateforme",
        ],
      },
    ],
  },
  {
    id: "propriete",
    title: "Propriété intellectuelle",
    blocks: [
      "L'ensemble du contenu présent sur NOMAQbanq (textes, questions, explications, graphiques, logos, logiciels) est protégé par les lois sur la propriété intellectuelle.",
      "Toute reproduction, représentation, modification ou distribution, même partielle, du contenu de la plateforme sans autorisation écrite préalable est strictement interdite.",
    ],
  },
  {
    id: "paiement",
    title: "Tarification et paiement",
    blocks: [
      "L'accès aux fonctionnalités premium de NOMAQbanq est soumis à un abonnement payant. Les modalités de paiement sont les suivantes :",
      {
        list: [
          "Les prix sont affichés en dollars canadiens (CAD)",
          "Le paiement est effectué via notre prestataire sécurisé Stripe",
          "Les abonnements sont à durée déterminée et non renouvelés automatiquement",
          "Les remboursements sont accordés selon notre politique de remboursement",
        ],
      },
    ],
  },
  {
    id: "responsabilite",
    title: "Limitation de responsabilité",
    blocks: [
      "NOMAQbanq s'efforce de fournir des informations exactes et à jour. Cependant, nous ne garantissons pas :",
      {
        list: [
          "L'exactitude ou l'exhaustivité du contenu pédagogique",
          "La réussite à l'examen EACMC suite à l'utilisation de nos services",
          "La disponibilité ininterrompue de la plateforme",
        ],
      },
      "En aucun cas, NOMAQbanq ne pourra être tenu responsable des dommages indirects résultant de l'utilisation ou de l'impossibilité d'utiliser nos services.",
    ],
  },
  {
    id: "resiliation",
    title: "Résiliation",
    blocks: [
      "Vous pouvez résilier votre compte à tout moment en nous contactant. NOMAQbanq se réserve le droit de suspendre ou résilier votre accès en cas de :",
      {
        list: [
          "Violation des présentes conditions d'utilisation",
          "Utilisation frauduleuse ou abusive de la plateforme",
          "Non-paiement des sommes dues",
        ],
      },
    ],
  },
  {
    id: "modifications",
    title: "Modifications des conditions",
    blocks: [
      "NOMAQbanq se réserve le droit de modifier les présentes conditions à tout moment. Les utilisateurs seront informés des modifications significatives par courriel ou notification sur la plateforme.",
      "La poursuite de l'utilisation de la plateforme après notification des modifications vaut acceptation des nouvelles conditions.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    blocks: [
      "Pour toute question concernant les présentes conditions d'utilisation, vous pouvez nous contacter :",
      { contact: true },
      {
        small:
          "Les présentes conditions sont régies par les lois du Québec et du Canada. Tout litige sera soumis à la compétence exclusive des tribunaux du Québec.",
      },
    ],
  },
]

export default function ConditionsPage() {
  return (
    <>
      <LegalDocument
        num="01"
        title="Conditions d'utilisation"
        lead="Les règles qui régissent l'utilisation de notre plateforme de préparation à l'EACMC."
        updated="28 septembre 2026"
        articles={ARTICLES}
      />
      <CtaBand />
    </>
  )
}
