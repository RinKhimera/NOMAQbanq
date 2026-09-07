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
          Il permet au site de mémoriser certaines informations sur votre
          visite, comme votre langue préférée ou vos préférences
          d&apos;affichage.
        </p>
        <p>
          Les cookies peuvent être « de session » (supprimés à la fermeture du
          navigateur) ou « persistants » (conservés pendant une durée
          déterminée).
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
            fonctionnement du site (session de connexion, sécurité)
          </li>
          <li>
            <strong>Cookies fonctionnels :</strong> mémorisent vos préférences
            d&apos;affichage
          </li>
          <li>
            <strong>Cookies tiers :</strong> déposés par nos partenaires
            uniquement lors d&apos;un paiement ou d&apos;une connexion avec un
            compte Google
          </li>
        </ul>
        <p>
          NOMAQbanq n&apos;utilise actuellement aucun cookie analytique ni
          publicitaire.
        </p>
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
            <strong>Session de connexion :</strong> un cookie{" "}
            <code>better-auth.session_token</code>, posé par l&apos;application
            elle-même, vous identifie et maintient votre session. Il est
            inaccessible aux scripts (HttpOnly) et transmis uniquement en HTTPS
          </li>
          <li>
            <strong>Sécurité :</strong> des cookies temporaires protègent le
            flux de connexion avec un compte Google contre la falsification de
            requête ; ils sont supprimés dès la connexion terminée
          </li>
          <li>
            <strong>Préférences d&apos;affichage :</strong> l&apos;état ouvert
            ou replié du menu latéral (<code>sidebar_state</code>). Le thème
            clair/sombre est mémorisé dans le stockage local du navigateur, pas
            dans un cookie
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
        title="Mesure d'audience et erreurs"
        accentColor="amber"
      >
        <p>
          NOMAQbanq n&apos;utilise actuellement aucun cookie de mesure
          d&apos;audience. Les seules mesures d&apos;usage proviennent des
          journaux techniques de notre hébergeur (Vercel), qui ne reposent sur
          aucun cookie.
        </p>
        <p>
          Le suivi des erreurs techniques (Sentry) ne dépose pas de cookie.
          Lorsqu&apos;une erreur survient, il reçoit le contexte technique
          (page, navigateur, adresse IP, identifiant et adresse courriel du
          compte connecté) ainsi qu&apos;une reconstitution des dernières
          secondes de votre navigation (contenu affiché à l&apos;écran, clics,
          défilement), afin de reproduire et corriger le problème.
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
            <strong>Stripe :</strong> traitement sécurisé des paiements. Ses
            cookies sont déposés sur la page de paiement hébergée par Stripe,
            pas sur nomaqbanq.ca
          </li>
          <li>
            <strong>Google :</strong> uniquement si vous vous connectez avec un
            compte Google, sur les pages de Google
          </li>
          <li>
            <strong>Vercel :</strong> hébergement du site ; ne dépose aucun
            cookie de suivi
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
            <strong>Extensions :</strong> des extensions comme Privacy Badger ou
            uBlock Origin offrent un contrôle supplémentaire
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
            <strong>Session de connexion :</strong> 7 jours, prolongés à chaque
            jour d&apos;utilisation ; supprimée dès votre déconnexion
          </li>
          <li>
            <strong>Cookies de sécurité (connexion Google) :</strong> quelques
            minutes, le temps de la connexion
          </li>
          <li>
            <strong>Préférence du menu latéral :</strong> 7 jours
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
            <strong>Adresse :</strong> 114 rue Isabelle, Gatineau (Québec) J8Y
            5H3, Canada
          </li>
        </ul>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
          Cette politique de cookies peut être mise à jour périodiquement. Nous
          vous informerons de tout changement significatif.
        </p>
      </LegalSection>
    </>
  )
}
