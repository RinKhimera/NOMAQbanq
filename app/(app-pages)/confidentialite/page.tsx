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
import { LegalSection } from "@/components/layout/LegalSection"

export const metadata = {
  title: "Politique de confidentialité | NOMAQbanq",
  description:
    "Politique de confidentialité de NOMAQbanq - Comment nous collectons, utilisons et protégeons vos données personnelles.",
}

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 pt-20 dark:from-gray-950 dark:via-gray-900/95 dark:to-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="font-display mb-4 text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl dark:text-white">
            Politique de confidentialité
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Dernière mise à jour : 15 janvier 2024
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-lg prose-blue dark:prose-invert mx-auto max-w-none">
          <div className="rounded-3xl border border-gray-200/50 bg-white/80 p-8 shadow-xl shadow-blue-100/50 backdrop-blur-sm sm:p-12 dark:border-gray-800/50 dark:bg-gray-900/80 dark:shadow-blue-900/20">
            <div className="space-y-10">
              {/* Introduction */}
              <LegalSection
                icon={Shield}
                title="Introduction"
                colorScheme="blue"
                number={1}
              >
                <p className="leading-relaxed">
                  Chez NOMAQbanq, nous prenons très au sérieux la protection de
                  vos données personnelles. Cette politique de confidentialité
                  explique comment nous collectons, utilisons, partageons et
                  protégeons vos informations lorsque vous utilisez notre
                  plateforme de préparation à l&apos;EACMC Partie I.
                </p>
              </LegalSection>

              {/* Données collectées */}
              <LegalSection
                icon={Database}
                title="Données collectées"
                colorScheme="purple"
                number={2}
              >
                <p className="leading-relaxed">
                  Nous collectons les informations suivantes :
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                      Adresse IP, type de navigateur, système
                      d&apos;exploitation
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50">
                    <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                      Données de paiement
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Informations de facturation (sécurisées par nos
                      prestataires)
                    </p>
                  </div>
                </div>
              </LegalSection>

              {/* Utilisation des données */}
              <LegalSection
                icon={Eye}
                title="Utilisation des données"
                colorScheme="green"
                number={3}
              >
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
                        className="flex items-center gap-3 text-gray-700 dark:text-gray-300"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs text-white">
                          ✓
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </LegalSection>

              {/* Partage des données */}
              <LegalSection
                icon={FileText}
                title="Partage des données"
                colorScheme="orange"
                number={4}
              >
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
              </LegalSection>

              {/* Sécurité */}
              <LegalSection
                icon={Lock}
                title="Sécurité des données"
                colorScheme="red"
                number={5}
              >
                <p className="leading-relaxed">
                  Nous mettons en œuvre des mesures de sécurité techniques et
                  organisationnelles appropriées pour protéger vos données
                  contre l&apos;accès non autorisé, la perte, la destruction ou
                  la divulgation. Cela inclut le chiffrement des données
                  sensibles, l&apos;authentification sécurisée et des audits de
                  sécurité réguliers.
                </p>
              </LegalSection>

              {/* Vos droits */}
              <LegalSection
                icon={UserCheck}
                title="Vos droits"
                colorScheme="cyan"
                number={6}
              >
                <p className="leading-relaxed">
                  Conformément aux lois sur la protection des données, vous avez
                  le droit de :
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      className="flex items-center gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900/30 dark:bg-cyan-950/30"
                    >
                      <span className="text-cyan-500">→</span>
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
              </LegalSection>

              {/* Conservation des données */}
              <LegalSection
                icon={Timer}
                title="Conservation des données"
                colorScheme="indigo"
                number={7}
              >
                <p className="leading-relaxed">
                  Nous conservons vos données personnelles aussi longtemps que
                  nécessaire pour fournir nos services et respecter nos
                  obligations légales. Les données d&apos;apprentissage sont
                  conservées pendant la durée de votre abonnement plus 3 ans
                  pour les besoins réglementaires.
                </p>
              </LegalSection>

              {/* Contact */}
              <LegalSection
                icon={Mail}
                title="Contact"
                colorScheme="gray"
                number={8}
              >
                <p className="leading-relaxed">
                  Pour toute question concernant cette politique de
                  confidentialité, contactez-nous :
                </p>
                <div className="mt-6 space-y-4">
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
              </LegalSection>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
