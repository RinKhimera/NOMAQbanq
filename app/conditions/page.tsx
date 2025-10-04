import LegalLayout from "@/components/layout/LegalLayout"

export const metadata = {
  title: "Conditions d'utilisation | NOMAQbanq",
  description:
    "Conditions d'utilisation de NOMAQbanq - Règles et modalités d'utilisation de notre plateforme.",
}

export default function ConditionsPage() {
  return (
    <LegalLayout title="Conditions d'utilisation" lastUpdated="15 janvier 2024">
      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            1. Acceptation des conditions
          </h2>
          <p className="text-gray-700">
            En accédant et en utilisant la plateforme NOMAQbanq, vous acceptez
            d&apos;être lié par ces conditions d&apos;utilisation. Si vous
            n&apos;acceptez pas ces conditions, veuillez ne pas utiliser notre
            plateforme.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            2. Description du service
          </h2>
          <p className="text-gray-700">
            NOMAQbanq est une plateforme éducative francophone dédiée à la
            préparation de l&apos;EACMC Partie I. Nous proposons du contenu
            pédagogique, des évaluations, et des outils de suivi de progression
            pour aider les étudiants à réussir leur examen.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            3. Inscription et compte utilisateur
          </h2>
          <p className="mb-4 text-gray-700">
            Pour accéder à nos services, vous devez :
          </p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>Créer un compte avec des informations exactes et complètes</li>
            <li>
              Maintenir la confidentialité de vos identifiants de connexion
            </li>
            <li>Être responsable de toute activité sur votre compte</li>
            <li>
              Nous informer immédiatement de toute utilisation non autorisée
            </li>
            <li>Avoir au moins 18 ans ou obtenir le consentement parental</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            4. Propriété intellectuelle
          </h2>
          <p className="mb-4 text-gray-700">
            Tout le contenu de la plateforme NOMAQbanq (textes, images, vidéos,
            questions d&apos;examen, etc.) est protégé par le droit
            d&apos;auteur et d&apos;autres lois sur la propriété intellectuelle.
          </p>
          <p className="text-gray-700">Vous vous engagez à :</p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>
              Ne pas copier, reproduire ou distribuer notre contenu sans
              autorisation
            </li>
            <li>
              Utiliser le contenu uniquement à des fins d&apos;apprentissage
              personnel
            </li>
            <li>Ne pas partager vos accès avec d&apos;autres personnes</li>
            <li>Ne pas créer de travaux dérivés basés sur notre contenu</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            5. Abonnement et paiement
          </h2>
          <p className="mb-4 text-gray-700">
            Les modalités d&apos;abonnement comprennent :
          </p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>
              <strong>Facturation :</strong> Les frais d&apos;abonnement sont
              facturés selon le plan choisi (mensuel, trimestriel, annuel)
            </li>
            <li>
              <strong>Renouvellement :</strong> L&apos;abonnement se renouvelle
              automatiquement sauf annulation
            </li>
            <li>
              <strong>Annulation :</strong> Vous pouvez annuler à tout moment
              depuis votre compte
            </li>
            <li>
              <strong>Remboursement :</strong> Politique de remboursement de 14
              jours pour les nouveaux abonnés
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            6. Utilisation acceptable
          </h2>
          <p className="mb-4 text-gray-700">Vous vous engagez à ne pas :</p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>Utiliser la plateforme de manière frauduleuse ou illégale</li>
            <li>Tenter d&apos;accéder à des zones non autorisées du système</li>
            <li>Interférer avec le fonctionnement normal de la plateforme</li>
            <li>Harceler, menacer ou nuire à d&apos;autres utilisateurs</li>
            <li>Utiliser des robots, scrapers ou autres outils automatisés</li>
            <li>Transmettre des virus ou codes malveillants</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            7. Limitation de responsabilité
          </h2>
          <p className="text-gray-700">
            NOMAQbanq fournit la plateforme &quot;en l&apos;état&quot;. Nous ne
            garantissons pas que l&apos;utilisation de notre plateforme
            garantira votre réussite à l&apos;EACMC. Nous ne sommes pas
            responsables des dommages indirects, accessoires ou consécutifs
            résultant de l&apos;utilisation ou de l&apos;impossibilité
            d&apos;utiliser nos services.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            8. Résiliation
          </h2>
          <p className="text-gray-700">
            Nous nous réservons le droit de suspendre ou de résilier votre
            compte en cas de violation de ces conditions d&apos;utilisation,
            sans préavis et sans remboursement. Vous pouvez également résilier
            votre compte à tout moment depuis les paramètres de votre compte.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            9. Modifications des conditions
          </h2>
          <p className="text-gray-700">
            Nous nous réservons le droit de modifier ces conditions à tout
            moment. Les modifications importantes vous seront notifiées par
            e-mail. Votre utilisation continue de la plateforme après les
            modifications constitue votre acceptation des nouvelles conditions.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            10. Droit applicable
          </h2>
          <p className="text-gray-700">
            Ces conditions sont régies par les lois de la province de Québec et
            les lois du Canada applicables. Tout litige sera soumis à la
            compétence exclusive des tribunaux de Montréal, Québec.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            11. Contact
          </h2>
          <p className="text-gray-700">
            Pour toute question concernant ces conditions d&apos;utilisation :
          </p>
          <ul className="mt-4 space-y-2 text-gray-700">
            <li>
              <strong>E-mail :</strong>{" "}
              <a
                href="mailto:nomaqbanq@outlook.com"
                className="text-blue-600 hover:underline"
              >
                nomaqbanq@outlook.com
              </a>
            </li>
            <li>
              <strong>Téléphone :</strong> +1 (438) 875-0746
            </li>
            <li>
              <strong>Adresse :</strong> Montréal, QC, Canada
            </li>
          </ul>
        </section>
      </div>
    </LegalLayout>
  )
}
