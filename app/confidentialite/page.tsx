import {
  Database,
  Eye,
  FileText,
  Lock,
  Mail,
  Shield,
  Timer,
  UserCheck,
} from "lucide-react"
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
      <div className="space-y-10">
        {/* Introduction */}
        <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 dark:border-blue-900/30 dark:from-blue-950/30 dark:to-indigo-950/30">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-blue-500 p-3 text-white">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h2 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-white">
                1. Introduction
              </h2>
              <p className="leading-relaxed text-gray-700 dark:text-gray-300">
                Chez NOMAQbanq, nous prenons très au sérieux la protection de
                vos données personnelles. Cette politique de confidentialité
                explique comment nous collectons, utilisons, partageons et
                protégeons vos informations lorsque vous utilisez notre
                plateforme de préparation à l&apos;EACMC Partie I.
              </p>
            </div>
          </div>
        </section>

        {/* Données collectées */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-purple-500 p-3 text-white">
              <Database className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              2. Données collectées
            </h2>
          </div>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            Nous collectons les informations suivantes :
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50">
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Informations d&apos;identification
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Nom, prénom, adresse e-mail
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50">
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Données d&apos;utilisation
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Progression, résultats aux évaluations, temps passé
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50">
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Informations techniques
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Adresse IP, type de navigateur, système d&apos;exploitation
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50">
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Données de paiement
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Informations de facturation (sécurisées par nos prestataires)
              </p>
            </div>
          </div>
        </section>

        {/* Utilisation des données */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-green-500 p-3 text-white">
              <Eye className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              3. Utilisation des données
            </h2>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 dark:border-gray-800 dark:from-green-950/30 dark:to-emerald-950/30">
            <p className="mb-4 font-medium text-gray-900 dark:text-white">
              Nous utilisons vos données pour :
            </p>
            <ul className="space-y-3">
              {[
                "Fournir et améliorer nos services éducatifs",
                "Personnaliser votre expérience d'apprentissage",
                "Suivre votre progression et générer des rapports",
                "Communiquer avec vous concernant votre compte et nos services",
                "Assurer la sécurité et prévenir la fraude",
                "Respecter nos obligations légales",
              ].map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 text-gray-700 dark:text-gray-300"
                >
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs text-white">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Partage des données */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-orange-500 p-3 text-white">
              <FileText className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              4. Partage des données
            </h2>
          </div>
          <div className="rounded-xl border-l-4 border-orange-500 bg-orange-50 p-6 dark:bg-orange-950/30">
            <p className="mb-4 font-semibold text-gray-900 dark:text-white">
              ⚠️ Nous ne vendons jamais vos données personnelles.
            </p>
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              Nous pouvons partager vos informations avec :
            </p>
            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="text-orange-500">•</span>
                <div>
                  <strong className="text-gray-900 dark:text-white">
                    Prestataires de services :
                  </strong>{" "}
                  hébergement, paiement, analyses (sous accord de
                  confidentialité strict)
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500">•</span>
                <div>
                  <strong className="text-gray-900 dark:text-white">
                    Autorités légales :
                  </strong>{" "}
                  si requis par la loi ou pour protéger nos droits
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* Sécurité des données */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-red-500 p-3 text-white">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              5. Sécurité des données
            </h2>
          </div>
          <p className="leading-relaxed text-gray-700 dark:text-gray-300">
            Nous mettons en œuvre des mesures de sécurité techniques et
            organisationnelles appropriées pour protéger vos données contre tout
            accès non autorisé, modification, divulgation ou destruction. Cela
            inclut le chiffrement SSL, des serveurs sécurisés et des contrôles
            d&apos;accès stricts.
          </p>
        </section>

        {/* Vos droits */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-cyan-500 p-3 text-white">
              <UserCheck className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              6. Vos droits
            </h2>
          </div>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            Conformément aux lois sur la protection des données, vous avez le
            droit de :
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Accéder à vos données personnelles",
              "Rectifier vos données inexactes",
              "Demander la suppression de vos données",
              "Vous opposer au traitement de vos données",
              "Demander la portabilité de vos données",
              "Retirer votre consentement à tout moment",
            ].map((right, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900/30 dark:bg-cyan-950/30"
              >
                <span className="mt-0.5 text-cyan-500">→</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {right}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-6 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 p-4 text-gray-700 dark:from-blue-950/30 dark:to-purple-950/30 dark:text-gray-300">
            Pour exercer ces droits, contactez-nous à{" "}
            <a
              href="mailto:nomaqbanq@outlook.com"
              className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              nomaqbanq@outlook.com
            </a>
          </p>
        </section>

        {/* Conservation des données */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-indigo-500 p-3 text-white">
              <Timer className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              7. Conservation des données
            </h2>
          </div>
          <p className="leading-relaxed text-gray-700 dark:text-gray-300">
            Nous conservons vos données personnelles aussi longtemps que
            nécessaire pour fournir nos services et respecter nos obligations
            légales. Les données d&apos;apprentissage sont conservées pendant la
            durée de votre abonnement plus 3 ans pour les besoins
            réglementaires.
          </p>
        </section>

        {/* Contact */}
        <section className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50 p-8 dark:border-gray-800 dark:from-gray-900/50 dark:to-blue-950/30">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-blue-500 p-3 text-white">
              <Mail className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              8. Contact
            </h2>
          </div>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            Pour toute question concernant cette politique de confidentialité,
            contactez-nous :
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900/50">
              <Mail className="h-5 w-5 text-blue-500" />
              <div>
                <span className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  E-mail
                </span>
                <a
                  href="mailto:nomaqbanq@outlook.com"
                  className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  nomaqbanq@outlook.com
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900/50">
              <span className="text-2xl">📞</span>
              <div>
                <span className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Téléphone
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  +1 (438) 875-0746
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900/50">
              <span className="text-2xl">📍</span>
              <div>
                <span className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Adresse
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  Montréal, QC, Canada
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </LegalLayout>
  )
}
