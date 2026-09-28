import { Metadata } from "next"
import type { ReactNode } from "react"
import { CtaBand } from "@/components/marketing/cta-band"
import {
  type LegalArticle,
  LegalDocument,
} from "@/components/shared/legal-document"

export const metadata: Metadata = {
  title: "Politique de cookies | NOMAQbanq",
  description:
    "Informations sur l'utilisation des cookies et traceurs sur la plateforme NOMAQbanq.",
  alternates: {
    canonical: "https://nomaqbanq.ca/cookies",
  },
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="bg-surface-2 border-line text-ink rounded-xs border px-1.5 py-px font-mono text-[0.88em]">
    {children}
  </code>
)

const ARTICLES: LegalArticle[] = [
  {
    id: "definition",
    title: "Qu'est-ce qu'un cookie ?",
    blocks: [
      "Un cookie est un petit fichier texte déposé sur votre appareil (ordinateur, tablette ou téléphone) lorsque vous visitez un site web. Il permet au site de mémoriser certaines informations sur votre visite, comme votre langue préférée ou vos préférences d'affichage.",
      "Les cookies peuvent être « de session » (supprimés à la fermeture du navigateur) ou « persistants » (conservés pendant une durée déterminée).",
    ],
  },
  {
    id: "types",
    title: "Types de cookies utilisés",
    blocks: [
      "NOMAQbanq utilise différentes catégories de cookies :",
      {
        list: [
          [
            "Cookies essentiels",
            "indispensables au fonctionnement du site (session de connexion, sécurité)",
          ],
          ["Cookies fonctionnels", "mémorisent vos préférences d'affichage"],
          [
            "Cookies tiers",
            "déposés par nos partenaires uniquement lors d'un paiement ou d'une connexion avec un compte Google",
          ],
        ],
      },
      "NOMAQbanq n'utilise actuellement aucun cookie analytique ni publicitaire.",
    ],
  },
  {
    id: "essentiels",
    title: "Cookies essentiels",
    blocks: [
      "Ces cookies sont nécessaires au fonctionnement de la plateforme et ne peuvent pas être désactivés. Ils incluent :",
      {
        list: [
          [
            "Session de connexion",
            <>
              un cookie <Code>better-auth.session_token</Code>, posé par
              l&apos;application elle-même, vous identifie et maintient votre
              session. Il est inaccessible aux scripts (HttpOnly) et transmis
              uniquement en HTTPS
            </>,
          ],
          [
            "Sécurité",
            "des cookies temporaires protègent le flux de connexion avec un compte Google contre la falsification de requête ; ils sont supprimés dès la connexion terminée",
          ],
          [
            "Préférences d'affichage",
            "le thème clair/sombre est mémorisé dans le stockage local du navigateur, pas dans un cookie",
          ],
        ],
      },
      {
        note: "Ces cookies ne collectent aucune information personnelle à des fins marketing.",
      },
    ],
  },
  {
    id: "analytiques",
    title: "Mesure d'audience et erreurs",
    blocks: [
      "NOMAQbanq n'utilise actuellement aucun cookie de mesure d'audience. Les seules mesures d'usage proviennent des journaux techniques de notre hébergeur (Vercel), qui ne reposent sur aucun cookie.",
      "Le suivi des erreurs techniques (Sentry) ne dépose pas de cookie. Lorsqu'une erreur survient, il reçoit le contexte technique (page, navigateur, adresse IP, identifiant et adresse courriel du compte connecté) ainsi qu'une reconstitution des dernières secondes de votre navigation (contenu affiché à l'écran, clics, défilement), afin de reproduire et corriger le problème.",
    ],
  },
  {
    id: "tiers",
    title: "Cookies tiers",
    blocks: [
      "Certains services tiers utilisés par NOMAQbanq peuvent déposer leurs propres cookies :",
      {
        list: [
          [
            "Stripe",
            "traitement sécurisé des paiements. Ses cookies sont déposés sur la page de paiement hébergée par Stripe, pas sur nomaqbanq.ca",
          ],
          [
            "Google",
            "uniquement si vous vous connectez avec un compte Google, sur les pages de Google",
          ],
          ["Vercel", "hébergement du site ; ne dépose aucun cookie de suivi"],
        ],
      },
      "Ces partenaires ont leurs propres politiques de confidentialité que nous vous invitons à consulter.",
    ],
  },
  {
    id: "gestion",
    title: "Gestion de vos préférences",
    blocks: [
      "Vous pouvez gérer vos préférences en matière de cookies de plusieurs façons :",
      {
        list: [
          [
            "Paramètres du navigateur",
            "la plupart des navigateurs permettent de bloquer ou supprimer les cookies",
          ],
          [
            "Outils de navigation privée",
            "utilisez le mode incognito pour limiter le suivi",
          ],
          [
            "Extensions",
            "des extensions comme Privacy Badger ou uBlock Origin offrent un contrôle supplémentaire",
          ],
        ],
      },
      {
        note: (
          <>
            <strong className="text-ink">Attention :</strong> la désactivation
            de certains cookies peut affecter le fonctionnement de la plateforme
            et limiter l&apos;accès à certaines fonctionnalités.
          </>
        ),
      },
    ],
  },
  {
    id: "duree",
    title: "Durée de conservation",
    blocks: [
      "La durée de conservation des cookies varie selon leur type :",
      {
        list: [
          [
            "Session de connexion",
            "7 jours, prolongés à chaque jour d'utilisation ; supprimée dès votre déconnexion",
          ],
          [
            "Cookies de sécurité (connexion Google)",
            "quelques minutes, le temps de la connexion",
          ],
        ],
      },
    ],
  },
  {
    id: "contact-cookies",
    title: "Contact",
    blocks: [
      "Pour toute question concernant notre utilisation des cookies, vous pouvez nous contacter :",
      { contact: true },
      {
        small:
          "Cette politique de cookies peut être mise à jour périodiquement. Nous vous informerons de tout changement significatif.",
      },
    ],
  },
]

export default function CookiesPage() {
  return (
    <>
      <LegalDocument
        num="03"
        title="Politique de cookies"
        lead="Comprendre comment nous utilisons les cookies et traceurs pour améliorer votre expérience."
        updated="15 janvier 2026"
        articles={ARTICLES}
      />
      <CtaBand />
    </>
  )
}
