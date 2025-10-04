import {
  AlertTriangle,
  Ban,
  BookOpen,
  Copyright,
  CreditCard,
  FileCheck,
  Gavel,
  Mail,
  RefreshCw,
  ShieldAlert,
  UserCog,
} from "lucide-react"
import LegalLayout from "@/components/layout/LegalLayout"

export const metadata = {
  title: "Conditions d'utilisation | NOMAQbanq",
  description:
    "Conditions d'utilisation de NOMAQbanq - Règles et modalités d'utilisation de notre plateforme.",
}

export default function ConditionsPage() {
  return (
    <LegalLayout title="Conditions d'utilisation" lastUpdated="15 janvier 2024">
      <div className="space-y-10">
        {/* Acceptation */}
        <section className="rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-6 dark:border-green-900/30 dark:from-green-950/30 dark:to-emerald-950/30">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-green-500 p-3 text-white">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="mb-3 text-2xl font-semibold text-gray-900 dark:text-white">
                1. Acceptation des conditions
              </h2>
              <p className="leading-relaxed text-gray-700 dark:text-gray-300">
                En accédant et en utilisant la plateforme NOMAQbanq, vous
                acceptez d&apos;être lié par ces conditions d&apos;utilisation.
                Si vous n&apos;acceptez pas ces conditions, veuillez ne pas
                utiliser notre plateforme.
              </p>
            </div>
          </div>
        </section>

        {/* Description du service */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-blue-500 p-3 text-white">
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              2. Description du service
            </h2>
          </div>
          <p className="leading-relaxed text-gray-700 dark:text-gray-300">
            NOMAQbanq est une plateforme éducative francophone dédiée à la
            préparation de l&apos;EACMC Partie I. Nous proposons du contenu
            pédagogique, des évaluations, et des outils de suivi de progression
            pour aider les étudiants à réussir leur examen.
          </p>
        </section>

        {/* Inscription */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-purple-500 p-3 text-white">
              <UserCog className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              3. Inscription et compte utilisateur
            </h2>
          </div>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            Pour accéder à nos services, vous devez :
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Créer un compte avec des informations exactes et complètes",
              "Maintenir la confidentialité de vos identifiants de connexion",
              "Être responsable de toute activité sur votre compte",
              "Nous informer immédiatement de toute utilisation non autorisée",
              "Avoir au moins 18 ans ou obtenir le consentement parental",
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/30 dark:bg-purple-950/30"
              >
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500 text-xs text-white">
                  {index + 1}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Propriété intellectuelle */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-orange-500 p-3 text-white">
              <Copyright className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              4. Propriété intellectuelle
            </h2>
          </div>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Tout le contenu de la plateforme NOMAQbanq (textes, images,
              vidéos, questions d&apos;examen, etc.) est protégé par le droit
              d&apos;auteur et d&apos;autres lois sur la propriété
              intellectuelle.
            </p>
            <div className="rounded-xl border-l-4 border-orange-500 bg-orange-50 p-6 dark:bg-orange-950/30">
              <p className="mb-4 font-semibold text-gray-900 dark:text-white">
                Vous vous engagez à :
              </p>
              <ul className="space-y-3">
                {[
                  "Ne pas copier, reproduire ou distribuer notre contenu sans autorisation",
                  "Utiliser le contenu uniquement à des fins d'apprentissage personnel",
                  "Ne pas partager vos accès avec d'autres personnes",
                  "Ne pas créer de travaux dérivés basés sur notre contenu",
                ].map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 text-gray-700 dark:text-gray-300"
                  >
                    <span className="text-orange-500">✗</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Abonnement et paiement */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-cyan-500 p-3 text-white">
              <CreditCard className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              5. Abonnement et paiement
            </h2>
          </div>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            Les modalités d&apos;abonnement comprennent :
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-cyan-200 bg-white p-6 shadow-sm dark:border-cyan-900/30 dark:bg-gray-900/50">
              <div className="mb-3 inline-flex rounded-full bg-cyan-100 p-2 dark:bg-cyan-900/30">
                <CreditCard className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Facturation
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Les frais d&apos;abonnement sont facturés selon le plan choisi
                (mensuel, trimestriel, annuel)
              </p>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-white p-6 shadow-sm dark:border-cyan-900/30 dark:bg-gray-900/50">
              <div className="mb-3 inline-flex rounded-full bg-cyan-100 p-2 dark:bg-cyan-900/30">
                <RefreshCw className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Renouvellement
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                L&apos;abonnement se renouvelle automatiquement sauf annulation
              </p>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-white p-6 shadow-sm dark:border-cyan-900/30 dark:bg-gray-900/50">
              <div className="mb-3 inline-flex rounded-full bg-cyan-100 p-2 dark:bg-cyan-900/30">
                <Ban className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                Annulation
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Vous pouvez annuler à tout moment depuis votre compte
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 p-4 dark:from-green-950/30 dark:to-emerald-950/30">
            <p className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span className="text-green-500">✓</span>
              <strong>Remboursement :</strong> Politique de remboursement de 14
              jours pour les nouveaux abonnés
            </p>
          </div>
        </section>

        {/* Utilisation acceptable */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-red-500 p-3 text-white">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              6. Utilisation acceptable
            </h2>
          </div>
          <div className="rounded-xl border-l-4 border-red-500 bg-red-50 p-6 dark:bg-red-950/30">
            <p className="mb-4 font-semibold text-gray-900 dark:text-white">
              Vous vous engagez à ne pas :
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Utiliser la plateforme de manière frauduleuse ou illégale",
                "Tenter d'accéder à des zones non autorisées du système",
                "Interférer avec le fonctionnement normal de la plateforme",
                "Harceler, menacer ou nuire à d'autres utilisateurs",
                "Utiliser des robots, scrapers ou autres outils automatisés",
                "Transmettre des virus ou codes malveillants",
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 text-gray-700 dark:text-gray-300"
                >
                  <span className="mt-1 text-red-500">⚠</span>
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Limitation de responsabilité */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-yellow-500 p-3 text-white">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              7. Limitation de responsabilité
            </h2>
          </div>
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-900/30 dark:bg-yellow-950/30">
            <p className="leading-relaxed text-gray-700 dark:text-gray-300">
              NOMAQbanq fournit la plateforme &quot;en l&apos;état&quot;. Nous
              ne garantissons pas que l&apos;utilisation de notre plateforme
              garantira votre réussite à l&apos;EACMC. Nous ne sommes pas
              responsables des dommages indirects, accessoires ou consécutifs
              résultant de l&apos;utilisation ou de l&apos;impossibilité
              d&apos;utiliser nos services.
            </p>
          </div>
        </section>

        {/* Résiliation */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-rose-500 p-3 text-white">
              <Ban className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              8. Résiliation
            </h2>
          </div>
          <p className="leading-relaxed text-gray-700 dark:text-gray-300">
            Nous nous réservons le droit de suspendre ou de résilier votre
            compte en cas de violation de ces conditions d&apos;utilisation,
            sans préavis et sans remboursement. Vous pouvez également résilier
            votre compte à tout moment depuis les paramètres de votre compte.
          </p>
        </section>

        {/* Modifications */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-indigo-500 p-3 text-white">
              <RefreshCw className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              9. Modifications des conditions
            </h2>
          </div>
          <p className="leading-relaxed text-gray-700 dark:text-gray-300">
            Nous nous réservons le droit de modifier ces conditions à tout
            moment. Les modifications importantes vous seront notifiées par
            e-mail. Votre utilisation continue de la plateforme après les
            modifications constitue votre acceptation des nouvelles conditions.
          </p>
        </section>

        {/* Droit applicable */}
        <section>
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-teal-500 p-3 text-white">
              <Gavel className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              10. Droit applicable
            </h2>
          </div>
          <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 p-6 dark:border-teal-900/30 dark:from-teal-950/30 dark:to-cyan-950/30">
            <p className="leading-relaxed text-gray-700 dark:text-gray-300">
              Ces conditions sont régies par les lois de la province de Québec
              et les lois du Canada applicables. Tout litige sera soumis à la
              compétence exclusive des tribunaux de Montréal, Québec.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50 p-8 dark:border-gray-800 dark:from-gray-900/50 dark:to-blue-950/30">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-full bg-blue-500 p-3 text-white">
              <Mail className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              11. Contact
            </h2>
          </div>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            Pour toute question concernant ces conditions d&apos;utilisation :
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
