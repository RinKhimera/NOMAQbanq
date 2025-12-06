import {
  AlertTriangle,
  Chrome,
  Clock,
  Cookie,
  Database,
  Eye,
  Globe,
  Info,
  Mail,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react"
import { LegalSection } from "@/components/layout/legal-section"
import { Badge } from "@/components/ui/badge"

export const metadata = {
  title: "Politique de cookies | NOMAQbanq",
  description:
    "Politique de cookies de NOMAQbanq - Comment nous utilisons les cookies et technologies similaires.",
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 pt-20 dark:from-gray-950 dark:via-gray-900/95 dark:to-gray-950">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="font-display mb-4 text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl dark:text-white">
            Politique de cookies
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
                icon={Cookie}
                title="Qu'est-ce qu'un cookie ?"
                colorScheme="amber"
                number={1}
              >
                <p className="leading-relaxed">
                  Un cookie est un petit fichier texte stocké sur votre appareil
                  (ordinateur, tablette ou mobile) lorsque vous visitez un site
                  web. Les cookies permettent au site de reconnaître votre
                  appareil et de mémoriser certaines informations sur vos
                  préférences ou actions passées.
                </p>
              </LegalSection>

              {/* Types de cookies */}
              <LegalSection
                icon={Settings}
                title="Types de cookies utilisés"
                colorScheme="blue"
                number={2}
              >
                <div className="space-y-6">
                  {/* Cookies strictement nécessaires */}
                  <div className="overflow-hidden rounded-2xl border border-green-200 bg-white shadow-sm dark:border-green-900/30 dark:bg-gray-900/50">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 dark:from-green-950/30 dark:to-emerald-950/30">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
                          <ShieldCheck className="h-6 w-6 text-green-500" />
                          2.1 Cookies strictement nécessaires
                        </h3>
                        <Badge className="bg-green-500 text-white hover:bg-green-600">
                          Obligatoires
                        </Badge>
                      </div>
                      <p className="mb-4 text-gray-700 dark:text-gray-300">
                        Ces cookies sont essentiels au fonctionnement de notre
                        plateforme. Ils vous permettent de naviguer sur le site
                        et d&apos;utiliser ses fonctionnalités de base.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          "Authentification et gestion de session",
                          "Sécurité et prévention de la fraude",
                          "Mémorisation des préférences de langue",
                        ].map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-lg bg-white/50 p-3 dark:bg-gray-900/50"
                          >
                            <span className="text-green-500">✓</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Cookies de performance */}
                  <div className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm dark:border-blue-900/30 dark:bg-gray-900/50">
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 dark:from-blue-950/30 dark:to-cyan-950/30">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
                          <Eye className="h-6 w-6 text-blue-500" />
                          2.2 Cookies de performance
                        </h3>
                        <Badge
                          variant="outline"
                          className="border-blue-500 text-blue-700 dark:text-blue-300"
                        >
                          Optionnels
                        </Badge>
                      </div>
                      <p className="mb-4 text-gray-700 dark:text-gray-300">
                        Ces cookies collectent des informations sur la façon
                        dont vous utilisez notre plateforme, nous permettant
                        d&apos;améliorer nos services.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          "Pages visitées et temps passé",
                          "Sources de trafic",
                          "Erreurs rencontrées",
                          "Analyse de l'utilisation des fonctionnalités",
                        ].map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-lg bg-white/50 p-3 dark:bg-gray-900/50"
                          >
                            <span className="text-blue-500">→</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Cookies de fonctionnalité */}
                  <div className="overflow-hidden rounded-2xl border border-purple-200 bg-white shadow-sm dark:border-purple-900/30 dark:bg-gray-900/50">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 dark:from-purple-950/30 dark:to-pink-950/30">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
                          <Sparkles className="h-6 w-6 text-purple-500" />
                          2.3 Cookies de fonctionnalité
                        </h3>
                        <Badge
                          variant="outline"
                          className="border-purple-500 text-purple-700 dark:text-purple-300"
                        >
                          Optionnels
                        </Badge>
                      </div>
                      <p className="mb-4 text-gray-700 dark:text-gray-300">
                        Ces cookies permettent de mémoriser vos choix et de
                        personnaliser votre expérience.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          "Progression dans les modules",
                          "Préférences d'affichage (mode sombre/clair)",
                          "Paramètres personnalisés",
                          "Historique de navigation sur la plateforme",
                        ].map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-lg bg-white/50 p-3 dark:bg-gray-900/50"
                          >
                            <span className="text-purple-500">★</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Cookies de ciblage */}
                  <div className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm dark:border-orange-900/30 dark:bg-gray-900/50">
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 dark:from-orange-950/30 dark:to-red-950/30">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
                          <Target className="h-6 w-6 text-orange-500" />
                          2.4 Cookies de ciblage/publicité
                        </h3>
                        <Badge
                          variant="outline"
                          className="border-orange-500 text-orange-700 dark:text-orange-300"
                        >
                          Optionnels
                        </Badge>
                      </div>
                      <p className="mb-4 text-gray-700 dark:text-gray-300">
                        Ces cookies sont utilisés pour afficher des publicités
                        pertinentes et mesurer l&apos;efficacité de nos
                        campagnes marketing.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          "Publicités personnalisées",
                          "Suivi des conversions",
                          "Reciblage publicitaire",
                        ].map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-lg bg-white/50 p-3 dark:bg-gray-900/50"
                          >
                            <span className="text-orange-500">◉</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </LegalSection>

              {/* Cookies tiers */}
              <LegalSection
                icon={Globe}
                title="Cookies tiers"
                colorScheme="indigo"
                number={3}
              >
                <p className="leading-relaxed">
                  Nous utilisons également des services tiers qui peuvent
                  déposer des cookies sur votre appareil :
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      name: "Google Analytics",
                      desc: "Analyse d'audience et de performance",
                      icon: "📊",
                    },
                    {
                      name: "Stripe",
                      desc: "Traitement sécurisé des paiements",
                      icon: "💳",
                    },
                    {
                      name: "Réseaux sociaux",
                      desc: "Partage de contenu et widgets sociaux",
                      icon: "🌐",
                    },
                    {
                      name: "Services d'hébergement",
                      desc: "Optimisation de la performance",
                      icon: "⚡",
                    },
                  ].map((service, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm dark:border-indigo-900/30 dark:bg-gray-900/50"
                    >
                      <span className="text-3xl">{service.icon}</span>
                      <div>
                        <h3 className="mb-1 font-semibold text-gray-900 dark:text-white">
                          {service.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {service.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </LegalSection>

              {/* Durée de conservation */}
              <LegalSection
                icon={Clock}
                title="Durée de conservation"
                colorScheme="cyan"
                number={4}
              >
                <p className="leading-relaxed">
                  Les cookies ont différentes durées de vie :
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-6 dark:border-cyan-900/30 dark:from-cyan-950/30 dark:to-blue-950/30">
                    <div className="mb-3 flex items-center gap-3">
                      <Database className="h-6 w-6 text-cyan-500" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Cookies de session
                      </h3>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Supprimés automatiquement à la fermeture du navigateur
                    </p>
                  </div>
                  <div className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-6 dark:border-cyan-900/30 dark:from-cyan-950/30 dark:to-blue-950/30">
                    <div className="mb-3 flex items-center gap-3">
                      <Clock className="h-6 w-6 text-cyan-500" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Cookies persistants
                      </h3>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Conservés de quelques jours à plusieurs années selon leur
                      fonction
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4 dark:bg-blue-950/30">
                  <p className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
                    <span>
                      <strong className="text-gray-900 dark:text-white">
                        Note :
                      </strong>{" "}
                      Vous pouvez consulter la durée de vie spécifique de chaque
                      cookie dans les paramètres de votre navigateur.
                    </span>
                  </p>
                </div>
              </LegalSection>

              {/* Gestion des cookies */}
              <LegalSection
                icon={Settings}
                title="Gestion des cookies"
                colorScheme="teal"
                number={5}
              >
                <div className="space-y-6">
                  {/* Via notre plateforme */}
                  <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 p-6 dark:border-teal-900/30 dark:from-teal-950/30 dark:to-cyan-950/30">
                    <h3 className="mb-3 flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
                      <span className="text-2xl">⚙️</span>
                      5.1 Via notre plateforme
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">
                      Vous pouvez gérer vos préférences de cookies directement
                      sur notre plateforme via le bandeau de consentement qui
                      apparaît lors de votre première visite, ou en accédant aux
                      paramètres de cookies dans votre compte.
                    </p>
                  </div>

                  {/* Via votre navigateur */}
                  <div>
                    <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
                      <Chrome className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                      5.2 Via votre navigateur
                    </h3>
                    <p className="mb-4 text-gray-700 dark:text-gray-300">
                      Tous les navigateurs modernes permettent de gérer les
                      cookies. Voici comment accéder aux paramètres de cookies :
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          browser: "Chrome",
                          path: "Paramètres → Confidentialité et sécurité → Cookies",
                        },
                        {
                          browser: "Firefox",
                          path: "Options → Vie privée et sécurité → Cookies et données de sites",
                        },
                        {
                          browser: "Safari",
                          path: "Préférences → Confidentialité → Cookies",
                        },
                        {
                          browser: "Edge",
                          path: "Paramètres → Cookies et autorisations de site",
                        },
                      ].map((item, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/50"
                        >
                          <h4 className="mb-2 font-semibold text-gray-900 dark:text-white">
                            {item.browser}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {item.path}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/30">
                    <p className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                      <span>
                        <strong className="text-gray-900 dark:text-white">
                          Attention :
                        </strong>{" "}
                        Le blocage de certains cookies peut affecter votre
                        expérience sur notre plateforme et limiter certaines
                        fonctionnalités.
                      </span>
                    </p>
                  </div>
                </div>
              </LegalSection>

              {/* Do Not Track */}
              <LegalSection
                icon={ShieldCheck}
                title="Do Not Track (DNT)"
                colorScheme="rose"
                number={6}
              >
                <div className="rounded-xl border border-rose-200 bg-white/50 p-6 dark:border-rose-900/50 dark:bg-gray-900/50">
                  <p className="leading-relaxed text-gray-700 dark:text-gray-300">
                    Nous respectons les signaux &quot;Do Not Track&quot; (DNT)
                    de votre navigateur. Si vous activez le DNT, nous ne
                    déposerons pas de cookies non essentiels et ne suivrons pas
                    votre activité à des fins publicitaires.
                  </p>
                </div>
              </LegalSection>

              {/* Technologies similaires */}
              <LegalSection
                icon={Database}
                title="Technologies similaires"
                colorScheme="violet"
                number={7}
              >
                <p className="leading-relaxed">
                  En plus des cookies, nous utilisons d&apos;autres technologies
                  similaires :
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {[
                    {
                      name: "Local Storage",
                      desc: "Pour stocker des préférences et des données de session",
                      icon: "💾",
                    },
                    {
                      name: "Session Storage",
                      desc: "Pour des données temporaires durant votre session",
                      icon: "⏱️",
                    },
                    {
                      name: "Pixels invisibles",
                      desc: "Pour mesurer l'ouverture des e-mails et l'engagement",
                      icon: "👁️",
                    },
                  ].map((tech, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-violet-200 bg-white p-5 shadow-sm dark:border-violet-900/30 dark:bg-gray-900/50"
                    >
                      <div className="mb-3 text-3xl">{tech.icon}</div>
                      <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                        {tech.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {tech.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </LegalSection>

              {/* Mises à jour */}
              <LegalSection
                icon={Info}
                title="Mises à jour de cette politique"
                colorScheme="emerald"
                number={8}
              >
                <p className="leading-relaxed">
                  Nous pouvons mettre à jour cette politique de cookies
                  périodiquement pour refléter les changements dans nos
                  pratiques ou pour d&apos;autres raisons opérationnelles,
                  légales ou réglementaires. Nous vous encourageons à consulter
                  régulièrement cette page.
                </p>
              </LegalSection>

              {/* Contact */}
              <LegalSection
                icon={Mail}
                title="Contact"
                colorScheme="gray"
                number={9}
              >
                <p className="leading-relaxed">
                  Pour toute question concernant notre utilisation des cookies :
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
