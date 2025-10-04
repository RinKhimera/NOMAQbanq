import LegalLayout from "@/components/layout/LegalLayout"

export const metadata = {
  title: "Politique de cookies | NOMAQbanq",
  description:
    "Politique de cookies de NOMAQbanq - Comment nous utilisons les cookies et technologies similaires.",
}

export default function CookiesPage() {
  return (
    <LegalLayout title="Politique de cookies" lastUpdated="15 janvier 2024">
      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            1. Qu&apos;est-ce qu&apos;un cookie ?
          </h2>
          <p className="text-gray-700">
            Un cookie est un petit fichier texte stocké sur votre appareil
            (ordinateur, tablette ou mobile) lorsque vous visitez un site web.
            Les cookies permettent au site de reconnaître votre appareil et de
            mémoriser certaines informations sur vos préférences ou actions
            passées.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            2. Types de cookies utilisés
          </h2>

          <h3 className="mt-6 mb-3 text-xl font-semibold text-gray-800">
            2.1 Cookies strictement nécessaires
          </h3>
          <p className="text-gray-700">
            Ces cookies sont essentiels au fonctionnement de notre plateforme.
            Ils vous permettent de naviguer sur le site et d&apos;utiliser ses
            fonctionnalités de base.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-gray-700">
            <li>Authentification et gestion de session</li>
            <li>Sécurité et prévention de la fraude</li>
            <li>Mémorisation des préférences de langue</li>
          </ul>

          <h3 className="mt-6 mb-3 text-xl font-semibold text-gray-800">
            2.2 Cookies de performance
          </h3>
          <p className="text-gray-700">
            Ces cookies collectent des informations sur la façon dont vous
            utilisez notre plateforme, nous permettant d&apos;améliorer nos
            services.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-gray-700">
            <li>Pages visitées et temps passé</li>
            <li>Sources de trafic</li>
            <li>Erreurs rencontrées</li>
            <li>Analyse de l&apos;utilisation des fonctionnalités</li>
          </ul>

          <h3 className="mt-6 mb-3 text-xl font-semibold text-gray-800">
            2.3 Cookies de fonctionnalité
          </h3>
          <p className="text-gray-700">
            Ces cookies permettent de mémoriser vos choix et de personnaliser
            votre expérience.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-gray-700">
            <li>Progression dans les modules</li>
            <li>Préférences d&apos;affichage (mode sombre/clair)</li>
            <li>Paramètres personnalisés</li>
            <li>Historique de navigation sur la plateforme</li>
          </ul>

          <h3 className="mt-6 mb-3 text-xl font-semibold text-gray-800">
            2.4 Cookies de ciblage/publicité
          </h3>
          <p className="text-gray-700">
            Ces cookies sont utilisés pour afficher des publicités pertinentes
            et mesurer l&apos;efficacité de nos campagnes marketing.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-gray-700">
            <li>Publicités personnalisées</li>
            <li>Suivi des conversions</li>
            <li>Reciblage publicitaire</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            3. Cookies tiers
          </h2>
          <p className="mb-4 text-gray-700">
            Nous utilisons également des services tiers qui peuvent déposer des
            cookies sur votre appareil :
          </p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>
              <strong>Google Analytics :</strong> Analyse d&apos;audience et de
              performance
            </li>
            <li>
              <strong>Stripe :</strong> Traitement sécurisé des paiements
            </li>
            <li>
              <strong>Réseaux sociaux :</strong> Partage de contenu et widgets
              sociaux
            </li>
            <li>
              <strong>Services d&apos;hébergement :</strong> Optimisation de la
              performance
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            4. Durée de conservation
          </h2>
          <p className="mb-4 text-gray-700">
            Les cookies ont différentes durées de vie :
          </p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>
              <strong>Cookies de session :</strong> Supprimés automatiquement à
              la fermeture du navigateur
            </li>
            <li>
              <strong>Cookies persistants :</strong> Conservés de quelques jours
              à plusieurs années selon leur fonction
            </li>
          </ul>
          <div className="mt-4 rounded-xl bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              <strong>Note :</strong> Vous pouvez consulter la durée de vie
              spécifique de chaque cookie dans les paramètres de votre
              navigateur.
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            5. Gestion des cookies
          </h2>

          <h3 className="mt-6 mb-3 text-xl font-semibold text-gray-800">
            5.1 Via notre plateforme
          </h3>
          <p className="text-gray-700">
            Vous pouvez gérer vos préférences de cookies directement sur notre
            plateforme via le bandeau de consentement qui apparaît lors de votre
            première visite, ou en accédant aux paramètres de cookies dans votre
            compte.
          </p>

          <h3 className="mt-6 mb-3 text-xl font-semibold text-gray-800">
            5.2 Via votre navigateur
          </h3>
          <p className="mb-4 text-gray-700">
            Tous les navigateurs modernes permettent de gérer les cookies. Voici
            comment accéder aux paramètres de cookies :
          </p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>
              <strong>Chrome :</strong> Paramètres → Confidentialité et sécurité
              → Cookies
            </li>
            <li>
              <strong>Firefox :</strong> Options → Vie privée et sécurité →
              Cookies et données de sites
            </li>
            <li>
              <strong>Safari :</strong> Préférences → Confidentialité → Cookies
            </li>
            <li>
              <strong>Edge :</strong> Paramètres → Cookies et autorisations de
              site
            </li>
          </ul>

          <div className="mt-4 rounded-xl bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              <strong>Attention :</strong> Le blocage de certains cookies peut
              affecter votre expérience sur notre plateforme et limiter
              certaines fonctionnalités.
            </p>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            6. Do Not Track (DNT)
          </h2>
          <p className="text-gray-700">
            Nous respectons les signaux &quot;Do Not Track&quot; (DNT) de votre
            navigateur. Si vous activez le DNT, nous ne déposerons pas de
            cookies non essentiels et ne suivrons pas votre activité à des fins
            publicitaires.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            7. Technologies similaires
          </h2>
          <p className="mb-4 text-gray-700">
            En plus des cookies, nous utilisons d&apos;autres technologies
            similaires :
          </p>
          <ul className="list-disc space-y-2 pl-6 text-gray-700">
            <li>
              <strong>Local Storage :</strong> Pour stocker des préférences et
              des données de session
            </li>
            <li>
              <strong>Session Storage :</strong> Pour des données temporaires
              durant votre session
            </li>
            <li>
              <strong>Pixels invisibles :</strong> Pour mesurer l&apos;ouverture
              des e-mails et l&apos;engagement
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            8. Mises à jour de cette politique
          </h2>
          <p className="text-gray-700">
            Nous pouvons mettre à jour cette politique de cookies périodiquement
            pour refléter les changements dans nos pratiques ou pour
            d&apos;autres raisons opérationnelles, légales ou réglementaires.
            Nous vous encourageons à consulter régulièrement cette page.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold text-gray-900">
            9. Contact
          </h2>
          <p className="text-gray-700">
            Pour toute question concernant notre utilisation des cookies :
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
