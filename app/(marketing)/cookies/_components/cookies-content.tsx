"use client"

import { LegalSection } from "@/components/shared/legal-section"

export const CookiesContent = () => {
  return (
    <>
      <LegalSection
        id="definition"
        number={1}
        title="Qu'est-ce qu'un cookie ?"
        accentColor="amber"
      >
        <p>
          Un cookie est un petit fichier texte déposé sur votre appareil
          (ordinateur, tablette ou téléphone) lorsque vous visitez un site web.
          Il permet au site de mémoriser certaines informations sur votre visite,
          comme votre langue préférée ou vos préférences d&apos;affichage.
        </p>
        <p>
          Les cookies peuvent être « de session » (supprimés à la fermeture du
          navigateur) ou « persistants » (conservés pendant une durée déterminée).
        </p>
      </LegalSection>

      <LegalSection
        id="types"
        number={2}
        title="Types de cookies utilisés"
        accentColor="amber"
      >
        <p>NOMAQbanq utilise différentes catégories de cookies :</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Cookies essentiels :</strong> indispensables au
            fonctionnement du site
          </li>
          <li>
            <strong>Cookies fonctionnels :</strong> améliorent votre expérience
            utilisateur
          </li>
          <li>
            <strong>Cookies analytiques :</strong> nous aident à comprendre
            comment vous utilisez le site
          </li>
          <li>
            <strong>Cookies tiers :</strong> déposés par nos partenaires de
            services
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="essentiels"
        number={3}
        title="Cookies essentiels"
        accentColor="amber"
      >
        <p>
          Ces cookies sont nécessaires au fonctionnement de la plateforme et ne
          peuvent pas être désactivés. Ils incluent :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Authentification (Clerk) :</strong> permettent de vous
            identifier et maintenir votre session de connexion
          </li>
          <li>
            <strong>Sécurité :</strong> protègent contre les attaques CSRF et
            autres menaces
          </li>
          <li>
            <strong>Préférences :</strong> mémorisent vos choix (thème clair/sombre)
          </li>
        </ul>
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
          Ces cookies ne collectent aucune information personnelle à des fins
          marketing.
        </p>
      </LegalSection>

      <LegalSection
        id="analytiques"
        number={4}
        title="Cookies analytiques"
        accentColor="amber"
      >
        <p>
          Ces cookies nous permettent de mesurer l&apos;audience du site et
          d&apos;analyser son utilisation pour l&apos;améliorer :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Nombre de visiteurs et pages consultées</li>
          <li>Temps passé sur chaque page</li>
          <li>Parcours de navigation sur le site</li>
          <li>Erreurs rencontrées par les utilisateurs</li>
        </ul>
        <p>
          Ces données sont anonymisées et ne permettent pas de vous identifier
          personnellement.
        </p>
      </LegalSection>

      <LegalSection
        id="tiers"
        number={5}
        title="Cookies tiers"
        accentColor="amber"
      >
        <p>
          Certains services tiers utilisés par NOMAQbanq peuvent déposer leurs
          propres cookies :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Clerk :</strong> gestion de l&apos;authentification et des
            sessions utilisateur
          </li>
          <li>
            <strong>Stripe :</strong> traitement sécurisé des paiements
          </li>
          <li>
            <strong>Sentry :</strong> détection et suivi des erreurs techniques
          </li>
          <li>
            <strong>Vercel :</strong> optimisation des performances et du cache
          </li>
        </ul>
        <p>
          Ces partenaires ont leurs propres politiques de confidentialité que
          nous vous invitons à consulter.
        </p>
      </LegalSection>

      <LegalSection
        id="gestion"
        number={6}
        title="Gestion de vos préférences"
        accentColor="amber"
      >
        <p>
          Vous pouvez gérer vos préférences en matière de cookies de plusieurs
          façons :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Paramètres du navigateur :</strong> la plupart des
            navigateurs permettent de bloquer ou supprimer les cookies
          </li>
          <li>
            <strong>Outils de navigation privée :</strong> utilisez le mode
            incognito pour limiter le suivi
          </li>
          <li>
            <strong>Extensions :</strong> des extensions comme Privacy Badger
            ou uBlock Origin offrent un contrôle supplémentaire
          </li>
        </ul>
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm dark:bg-amber-950/30">
          <strong>Attention :</strong> la désactivation de certains cookies peut
          affecter le fonctionnement de la plateforme et limiter l&apos;accès à
          certaines fonctionnalités.
        </p>
      </LegalSection>

      <LegalSection
        id="duree"
        number={7}
        title="Durée de conservation"
        accentColor="amber"
      >
        <p>La durée de conservation des cookies varie selon leur type :</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Cookies de session :</strong> supprimés à la fermeture du
            navigateur
          </li>
          <li>
            <strong>Cookies d&apos;authentification :</strong> jusqu&apos;à 30 jours
            (selon vos préférences de connexion)
          </li>
          <li>
            <strong>Cookies de préférences :</strong> jusqu&apos;à 1 an
          </li>
          <li>
            <strong>Cookies analytiques :</strong> jusqu&apos;à 13 mois
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="contact-cookies"
        number={8}
        title="Contact"
        accentColor="amber"
      >
        <p>
          Pour toute question concernant notre utilisation des cookies, vous
          pouvez nous contacter :
        </p>
        <ul className="list-none space-y-2">
          <li>
            <strong>Courriel :</strong> nomaqbanq@outlook.com
          </li>
          <li>
            <strong>Téléphone :</strong> +1 (438) 875-0746
          </li>
          <li>
            <strong>Adresse :</strong> Montréal, QC, Canada
          </li>
        </ul>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
          Cette politique de cookies peut être mise à jour périodiquement.
          Nous vous informerons de tout changement significatif.
        </p>
      </LegalSection>
    </>
  )
}
