"use client"

import { LegalSection } from "@/components/layout/legal-section"

export const ConditionsContent = () => {
  return (
    <>
      <LegalSection
        id="objet"
        number={1}
        title="Objet et acceptation des conditions"
        accentColor="blue"
      >
        <p>
          Les présentes conditions générales d&apos;utilisation régissent l&apos;accès et
          l&apos;utilisation de la plateforme NOMAQbanq. En accédant à nos services,
          vous acceptez d&apos;être lié par ces conditions.
        </p>
        <p>
          L&apos;utilisation de la plateforme implique l&apos;acceptation pleine et
          entière des présentes conditions. Si vous n&apos;acceptez pas ces
          conditions, veuillez ne pas utiliser nos services.
        </p>
      </LegalSection>

      <LegalSection
        id="services"
        number={2}
        title="Description des services"
        accentColor="blue"
      >
        <p>
          NOMAQbanq est une plateforme francophone de préparation à l&apos;examen
          EACMC Partie I (Examen d&apos;aptitude du Conseil médical du Canada).
          Nos services comprennent :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Accès à une banque de plus de 5 000 questions à choix multiples</li>
          <li>Examens blancs simulant les conditions réelles de l&apos;examen</li>
          <li>Suivi personnalisé de votre progression</li>
          <li>Explications détaillées pour chaque question</li>
        </ul>
      </LegalSection>

      <LegalSection
        id="compte"
        number={3}
        title="Création et gestion du compte"
        accentColor="blue"
      >
        <p>
          Pour accéder à nos services, vous devez créer un compte utilisateur.
          Vous êtes responsable de :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Fournir des informations exactes et à jour lors de l&apos;inscription</li>
          <li>Maintenir la confidentialité de vos identifiants de connexion</li>
          <li>Signaler immédiatement toute utilisation non autorisée de votre compte</li>
          <li>Toutes les activités effectuées depuis votre compte</li>
        </ul>
      </LegalSection>

      <LegalSection
        id="obligations"
        number={4}
        title="Obligations de l'utilisateur"
        accentColor="blue"
      >
        <p>En utilisant NOMAQbanq, vous vous engagez à :</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Utiliser la plateforme uniquement à des fins personnelles et éducatives</li>
          <li>Ne pas partager votre compte avec d&apos;autres personnes</li>
          <li>Ne pas reproduire, distribuer ou commercialiser le contenu de la plateforme</li>
          <li>Respecter les droits de propriété intellectuelle</li>
          <li>Ne pas tenter de contourner les mesures de sécurité de la plateforme</li>
        </ul>
      </LegalSection>

      <LegalSection
        id="propriete"
        number={5}
        title="Propriété intellectuelle"
        accentColor="blue"
      >
        <p>
          L&apos;ensemble du contenu présent sur NOMAQbanq (textes, questions,
          explications, graphiques, logos, logiciels) est protégé par les lois
          sur la propriété intellectuelle.
        </p>
        <p>
          Toute reproduction, représentation, modification ou distribution,
          même partielle, du contenu de la plateforme sans autorisation écrite
          préalable est strictement interdite.
        </p>
      </LegalSection>

      <LegalSection
        id="paiement"
        number={6}
        title="Tarification et paiement"
        accentColor="blue"
      >
        <p>
          L&apos;accès aux fonctionnalités premium de NOMAQbanq est soumis à un
          abonnement payant. Les modalités de paiement sont les suivantes :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Les prix sont affichés en dollars canadiens (CAD), taxes incluses</li>
          <li>Le paiement est effectué via notre prestataire sécurisé Stripe</li>
          <li>Les abonnements sont à durée déterminée et non renouvelés automatiquement</li>
          <li>Les remboursements sont accordés selon notre politique de remboursement</li>
        </ul>
      </LegalSection>

      <LegalSection
        id="responsabilite"
        number={7}
        title="Limitation de responsabilité"
        accentColor="blue"
      >
        <p>
          NOMAQbanq s&apos;efforce de fournir des informations exactes et à jour.
          Cependant, nous ne garantissons pas :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>L&apos;exactitude ou l&apos;exhaustivité du contenu pédagogique</li>
          <li>La réussite à l&apos;examen EACMC suite à l&apos;utilisation de nos services</li>
          <li>La disponibilité ininterrompue de la plateforme</li>
        </ul>
        <p>
          En aucun cas, NOMAQbanq ne pourra être tenu responsable des dommages
          indirects résultant de l&apos;utilisation ou de l&apos;impossibilité d&apos;utiliser
          nos services.
        </p>
      </LegalSection>

      <LegalSection
        id="resiliation"
        number={8}
        title="Résiliation"
        accentColor="blue"
      >
        <p>
          Vous pouvez résilier votre compte à tout moment en nous contactant.
          NOMAQbanq se réserve le droit de suspendre ou résilier votre accès
          en cas de :
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Violation des présentes conditions d&apos;utilisation</li>
          <li>Utilisation frauduleuse ou abusive de la plateforme</li>
          <li>Non-paiement des sommes dues</li>
        </ul>
      </LegalSection>

      <LegalSection
        id="modifications"
        number={9}
        title="Modifications des conditions"
        accentColor="blue"
      >
        <p>
          NOMAQbanq se réserve le droit de modifier les présentes conditions
          à tout moment. Les utilisateurs seront informés des modifications
          significatives par courriel ou notification sur la plateforme.
        </p>
        <p>
          La poursuite de l&apos;utilisation de la plateforme après notification
          des modifications vaut acceptation des nouvelles conditions.
        </p>
      </LegalSection>

      <LegalSection
        id="contact"
        number={10}
        title="Contact"
        accentColor="blue"
      >
        <p>
          Pour toute question concernant les présentes conditions d&apos;utilisation,
          vous pouvez nous contacter :
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
          Les présentes conditions sont régies par les lois du Québec et du
          Canada. Tout litige sera soumis à la compétence exclusive des
          tribunaux du Québec.
        </p>
      </LegalSection>
    </>
  )
}
