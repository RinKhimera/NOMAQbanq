"use client"

import { LegalSection } from "@/components/shared/legal-section"

export const PrivacyContent = () => {
  return (
    <>
      <LegalSection
        id="collecte"
        number={1}
        title="Données personnelles collectées"
        accentColor="violet"
      >
        <p>
          Dans le cadre de nos services, nous collectons les données
          personnelles suivantes :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Données d&apos;identification :</strong> nom, prénom, adresse
            courriel
          </li>
          <li>
            <strong>Données de connexion :</strong> adresse IP, type de
            navigateur, appareil utilisé
          </li>
          <li>
            <strong>Données d&apos;utilisation :</strong> historique des questions
            répondues, résultats aux examens, progression
          </li>
          <li>
            <strong>Données de paiement :</strong> traitées de manière sécurisée
            par notre prestataire Stripe
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="finalites"
        number={2}
        title="Finalités du traitement"
        accentColor="violet"
      >
        <p>Vos données personnelles sont utilisées pour :</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Créer et gérer votre compte utilisateur</li>
          <li>Fournir nos services de préparation à l&apos;EACMC</li>
          <li>Personnaliser votre expérience d&apos;apprentissage</li>
          <li>Traiter vos paiements et gérer vos abonnements</li>
          <li>Vous envoyer des communications relatives à votre compte</li>
          <li>Améliorer nos services et développer de nouvelles fonctionnalités</li>
          <li>Assurer la sécurité de la plateforme</li>
        </ul>
      </LegalSection>

      <LegalSection
        id="base-legale"
        number={3}
        title="Base légale du traitement"
        accentColor="violet"
      >
        <p>
          Le traitement de vos données personnelles repose sur les bases légales
          suivantes, conformément à la Loi 25 du Québec et au RGPD :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Exécution du contrat :</strong> pour la fourniture de nos
            services et la gestion de votre compte
          </li>
          <li>
            <strong>Consentement :</strong> pour l&apos;envoi de communications
            marketing et l&apos;utilisation de certains cookies
          </li>
          <li>
            <strong>Intérêt légitime :</strong> pour l&apos;amélioration de nos
            services et la prévention de la fraude
          </li>
          <li>
            <strong>Obligation légale :</strong> pour la conservation de
            certaines données à des fins comptables
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="destinataires"
        number={4}
        title="Destinataires des données"
        accentColor="violet"
      >
        <p>
          Vos données peuvent être partagées avec les catégories de
          destinataires suivantes :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Prestataires techniques :</strong> Convex (hébergement de
            données), Clerk (authentification), Vercel (hébergement web)
          </li>
          <li>
            <strong>Prestataire de paiement :</strong> Stripe
          </li>
          <li>
            <strong>Outils d&apos;analyse :</strong> pour comprendre l&apos;utilisation de
            la plateforme
          </li>
          <li>
            <strong>Autorités compétentes :</strong> en cas d&apos;obligation légale
          </li>
        </ul>
        <p>
          Nous ne vendons jamais vos données personnelles à des tiers à des fins
          commerciales.
        </p>
      </LegalSection>

      <LegalSection
        id="securite"
        number={5}
        title="Sécurité des données"
        accentColor="violet"
      >
        <p>
          Nous mettons en œuvre des mesures de sécurité techniques et
          organisationnelles pour protéger vos données :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Chiffrement des données en transit (HTTPS/TLS)</li>
          <li>Chiffrement des données sensibles au repos</li>
          <li>Authentification sécurisée via Clerk</li>
          <li>Accès restreint aux données sur la base du besoin d&apos;en connaître</li>
          <li>Surveillance et journalisation des accès</li>
          <li>Sauvegardes régulières des données</li>
        </ul>
      </LegalSection>

      <LegalSection
        id="conservation"
        number={6}
        title="Durée de conservation"
        accentColor="violet"
      >
        <p>
          Nous conservons vos données personnelles pendant les durées suivantes :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Données de compte :</strong> pendant la durée de votre
            inscription, puis 3 ans après la dernière activité
          </li>
          <li>
            <strong>Données de progression :</strong> pendant la durée de votre
            abonnement actif
          </li>
          <li>
            <strong>Données de facturation :</strong> 7 ans conformément aux
            obligations légales
          </li>
          <li>
            <strong>Journaux de connexion :</strong> 1 an
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="droits"
        number={7}
        title="Vos droits"
        accentColor="violet"
      >
        <p>
          Conformément à la Loi 25 du Québec et au RGPD, vous disposez des droits
          suivants :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Droit d&apos;accès :</strong> obtenir une copie de vos données
            personnelles
          </li>
          <li>
            <strong>Droit de rectification :</strong> corriger des données
            inexactes
          </li>
          <li>
            <strong>Droit à l&apos;effacement :</strong> demander la suppression de
            vos données
          </li>
          <li>
            <strong>Droit à la portabilité :</strong> recevoir vos données dans
            un format structuré
          </li>
          <li>
            <strong>Droit d&apos;opposition :</strong> vous opposer à certains
            traitements
          </li>
          <li>
            <strong>Droit de retrait du consentement :</strong> retirer votre
            consentement à tout moment
          </li>
        </ul>
        <p>
          Pour exercer ces droits, contactez-nous à nomaqbanq@outlook.com.
        </p>
      </LegalSection>

      <LegalSection
        id="transferts"
        number={8}
        title="Transferts internationaux"
        accentColor="violet"
      >
        <p>
          Certaines de vos données peuvent être transférées et traitées en
          dehors du Québec et du Canada, notamment aux États-Unis, par nos
          prestataires de services (Convex, Clerk, Stripe, Vercel).
        </p>
        <p>
          Ces transferts sont encadrés par des garanties appropriées, notamment
          des clauses contractuelles types et des certifications de conformité.
        </p>
      </LegalSection>

      <LegalSection
        id="mineurs"
        number={9}
        title="Protection des mineurs"
        accentColor="violet"
      >
        <p>
          NOMAQbanq est destiné aux professionnels de santé et étudiants en
          médecine majeurs. Nous ne collectons pas sciemment de données
          personnelles de mineurs de moins de 18 ans.
        </p>
        <p>
          Si nous apprenons que des données d&apos;un mineur ont été collectées,
          nous prendrons les mesures nécessaires pour les supprimer.
        </p>
      </LegalSection>

      <LegalSection
        id="contact-dpo"
        number={10}
        title="Contact et responsable des données"
        accentColor="violet"
      >
        <p>
          Pour toute question concernant la protection de vos données
          personnelles, vous pouvez contacter notre responsable des données :
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
          Vous avez également le droit de déposer une plainte auprès de la
          Commission d&apos;accès à l&apos;information du Québec (CAI) si vous estimez
          que vos droits n&apos;ont pas été respectés.
        </p>
      </LegalSection>
    </>
  )
}
