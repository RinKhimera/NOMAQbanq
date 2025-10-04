import LegalLayout from "@/components/layout/LegalLayout"

export const metadata = {
  title: "Politique de confidentialité | NOMAQbanq",
  description:
    "Politique de confidentialité de NOMAQbanq - Comment nous collectons, utilisons et protégeons vos données personnelles.",
}

export default function ConfidentialitePage() {
  return (
    <LegalLayout
      title="Politique de confidentialité"
      lastUpdated="15 janvier 2024"
    >
      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            1. Introduction
          </h2>
          <p className="text-gray-700">
            Chez NOMAQbanq, nous prenons très au sérieux la protection de vos
            données personnelles. Cette politique de confidentialité explique
            comment nous collectons, utilisons, partageons et protégeons vos
            informations lorsque vous utilisez notre plateforme de préparation à
            l&apos;EACMC Partie I.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            2. Données collectées
          </h2>
          <p className="mb-4 text-gray-700">
            Nous collectons les informations suivantes :
          </p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>
              <strong>Informations d&apos;identification :</strong> nom, prénom,
              adresse e-mail
            </li>
            <li>
              <strong>Données d&apos;utilisation :</strong> progression dans les
              modules, résultats aux évaluations, temps passé sur la plateforme
            </li>
            <li>
              <strong>Informations techniques :</strong> adresse IP, type de
              navigateur, système d&apos;exploitation
            </li>
            <li>
              <strong>Données de paiement :</strong> informations de facturation
              (traitées de manière sécurisée par nos prestataires de paiement)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            3. Utilisation des données
          </h2>
          <p className="mb-4 text-gray-700">
            Nous utilisons vos données pour :
          </p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>Fournir et améliorer nos services éducatifs</li>
            <li>Personnaliser votre expérience d&apos;apprentissage</li>
            <li>Suivre votre progression et générer des rapports</li>
            <li>
              Communiquer avec vous concernant votre compte et nos services
            </li>
            <li>Assurer la sécurité et prévenir la fraude</li>
            <li>Respecter nos obligations légales</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            4. Partage des données
          </h2>
          <p className="text-gray-700">
            Nous ne vendons jamais vos données personnelles. Nous pouvons
            partager vos informations avec :
          </p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>
              <strong>Prestataires de services :</strong> hébergement, paiement,
              analyses (sous accord de confidentialité strict)
            </li>
            <li>
              <strong>Autorités légales :</strong> si requis par la loi ou pour
              protéger nos droits
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            5. Sécurité des données
          </h2>
          <p className="text-gray-700">
            Nous mettons en œuvre des mesures de sécurité techniques et
            organisationnelles appropriées pour protéger vos données contre tout
            accès non autorisé, modification, divulgation ou destruction. Cela
            inclut le chiffrement SSL, des serveurs sécurisés et des contrôles
            d&apos;accès stricts.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            6. Vos droits
          </h2>
          <p className="mb-4 text-gray-700">
            Conformément aux lois sur la protection des données, vous avez le
            droit de :
          </p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>Accéder à vos données personnelles</li>
            <li>Rectifier vos données inexactes</li>
            <li>Demander la suppression de vos données</li>
            <li>Vous opposer au traitement de vos données</li>
            <li>Demander la portabilité de vos données</li>
            <li>Retirer votre consentement à tout moment</li>
          </ul>
          <p className="mt-4 text-gray-700">
            Pour exercer ces droits, contactez-nous à{" "}
            <a
              href="mailto:nomaqbanq@outlook.com"
              className="text-blue-600 hover:underline"
            >
              nomaqbanq@outlook.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            7. Conservation des données
          </h2>
          <p className="text-gray-700">
            Nous conservons vos données personnelles aussi longtemps que
            nécessaire pour fournir nos services et respecter nos obligations
            légales. Les données d&apos;apprentissage sont conservées pendant la
            durée de votre abonnement plus 3 ans pour les besoins
            réglementaires.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            8. Contact
          </h2>
          <p className="text-gray-700">
            Pour toute question concernant cette politique de confidentialité,
            contactez-nous :
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
