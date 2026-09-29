import { Metadata } from "next"
import { CtaBand } from "@/components/marketing/cta-band"
import {
  type LegalArticle,
  LegalDocument,
} from "@/components/shared/legal-document"

export const metadata: Metadata = {
  title: "Politique de confidentialité | NOMAQbanq",
  description:
    "Découvrez comment NOMAQbanq protège vos données personnelles et respecte votre vie privée.",
  alternates: {
    canonical: "https://nomaqbanq.ca/confidentialite",
  },
}

const ARTICLES: LegalArticle[] = [
  {
    id: "collecte",
    title: "Données personnelles collectées",
    blocks: [
      "Dans le cadre de nos services, nous collectons les données personnelles suivantes :",
      {
        list: [
          ["Données d'identification", "nom, prénom, adresse courriel"],
          [
            "Données de connexion",
            "adresse IP, type de navigateur, appareil utilisé",
          ],
          [
            "Données d'utilisation",
            "historique des questions répondues, résultats aux examens, progression",
          ],
          [
            "Données de paiement",
            "traitées de manière sécurisée par notre prestataire Stripe",
          ],
        ],
      },
    ],
  },
  {
    id: "finalites",
    title: "Finalités du traitement",
    blocks: [
      "Vos données personnelles sont utilisées pour :",
      {
        list: [
          "Créer et gérer votre compte utilisateur",
          "Fournir nos services de préparation à l'EACMC",
          "Personnaliser votre expérience d'apprentissage",
          "Traiter vos paiements et gérer vos abonnements",
          "Vous envoyer des communications relatives à votre compte",
          "Améliorer nos services et développer de nouvelles fonctionnalités",
          "Assurer la sécurité de la plateforme",
        ],
      },
    ],
  },
  {
    id: "base-legale",
    title: "Base légale du traitement",
    blocks: [
      "Le traitement de vos données personnelles repose sur les bases légales suivantes, conformément à la Loi 25 du Québec et au RGPD :",
      {
        list: [
          [
            "Exécution du contrat",
            "pour la fourniture de nos services et la gestion de votre compte",
          ],
          [
            "Consentement",
            "pour l'envoi de communications marketing et l'utilisation de certains cookies",
          ],
          [
            "Intérêt légitime",
            "pour l'amélioration de nos services et la prévention de la fraude",
          ],
          [
            "Obligation légale",
            "pour la conservation de certaines données à des fins comptables",
          ],
        ],
      },
    ],
  },
  {
    id: "destinataires",
    title: "Destinataires des données",
    blocks: [
      "Vos données peuvent être partagées avec les catégories de destinataires suivantes :",
      {
        list: [
          [
            "Prestataires techniques",
            "Neon (base de données), Amazon Web Services (envoi des courriels, stockage et diffusion des médias), Vercel (hébergement web), Sentry (suivi des erreurs techniques : contexte de l'erreur et reconstitution de l'écran au moment où elle survient)",
          ],
          ["Prestataire de paiement", "Stripe"],
          [
            "Connexion avec un compte Google",
            "si vous choisissez ce mode de connexion, Google nous transmet votre nom, votre adresse courriel et votre photo de profil",
          ],
          ["Autorités compétentes", "en cas d'obligation légale"],
        ],
      },
      "Nous n'utilisons actuellement aucun outil d'analyse d'audience tiers. Nous ne vendons jamais vos données personnelles à des tiers à des fins commerciales.",
    ],
  },
  {
    id: "securite",
    title: "Sécurité des données",
    blocks: [
      "Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles pour protéger vos données :",
      {
        list: [
          "Chiffrement des données en transit (HTTPS/TLS)",
          "Chiffrement des données sensibles au repos",
          "Authentification gérée par l'application elle-même : mots de passe hachés (jamais conservés en clair), sessions enregistrées dans notre base de données, connexion avec un compte Google en option",
          "Accès restreint aux données sur la base du besoin d'en connaître",
          "Surveillance et journalisation des accès",
          "Sauvegardes régulières des données",
        ],
      },
    ],
  },
  {
    id: "conservation",
    title: "Durée de conservation",
    blocks: [
      "Nous conservons vos données personnelles pendant les durées suivantes :",
      {
        list: [
          [
            "Données de compte",
            "pendant la durée de votre inscription, puis 3 ans après la dernière activité",
          ],
          [
            "Données de progression",
            "pendant la durée de votre abonnement actif",
          ],
          [
            "Données de facturation",
            "7 ans conformément aux obligations légales",
          ],
          ["Journaux de connexion", "1 an"],
        ],
      },
    ],
  },
  {
    id: "droits",
    title: "Vos droits",
    blocks: [
      "Conformément à la Loi 25 du Québec et au RGPD, vous disposez des droits suivants :",
      {
        list: [
          ["Droit d'accès", "obtenir une copie de vos données personnelles"],
          ["Droit de rectification", "corriger des données inexactes"],
          ["Droit à l'effacement", "demander la suppression de vos données"],
          [
            "Droit à la portabilité",
            "recevoir vos données dans un format structuré",
          ],
          ["Droit d'opposition", "vous opposer à certains traitements"],
          [
            "Droit de retrait du consentement",
            "retirer votre consentement à tout moment",
          ],
        ],
      },
      "Pour exercer ces droits, contactez-nous à nomaqbanq@outlook.com.",
    ],
  },
  {
    id: "transferts",
    title: "Transferts internationaux",
    blocks: [
      "Certaines de vos données peuvent être transférées et traitées en dehors du Québec et du Canada, notamment aux États-Unis, par nos prestataires de services (Neon, Amazon Web Services, Stripe, Vercel, Sentry et, si vous vous connectez avec un compte Google, Google).",
      "Ces transferts sont encadrés par des garanties appropriées, notamment des clauses contractuelles types et des certifications de conformité.",
    ],
  },
  {
    id: "mineurs",
    title: "Protection des mineurs",
    blocks: [
      "NOMAQbanq est destiné aux professionnels de santé et étudiants en médecine majeurs. Nous ne collectons pas sciemment de données personnelles de mineurs de moins de 18 ans.",
      "Si nous apprenons que des données d'un mineur ont été collectées, nous prendrons les mesures nécessaires pour les supprimer.",
    ],
  },
  {
    id: "contact-dpo",
    title: "Contact et responsable des données",
    blocks: [
      "Pour toute question concernant la protection de vos données personnelles, vous pouvez contacter notre responsable des données :",
      { contact: true },
      {
        small:
          "Vous avez également le droit de déposer une plainte auprès de la Commission d'accès à l'information du Québec (CAI) si vous estimez que vos droits n'ont pas été respectés.",
      },
    ],
  },
]

export default function ConfidentialitePage() {
  return (
    <>
      <LegalDocument
        num="02"
        title="Politique de confidentialité"
        lead="Comment nous protégeons vos données personnelles et respectons votre vie privée."
        updated="15 janvier 2026"
        articles={ARTICLES}
      />
      <CtaBand />
    </>
  )
}
