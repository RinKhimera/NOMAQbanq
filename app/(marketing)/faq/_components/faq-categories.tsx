"use client"

import { useMemo } from "react"
import { motion } from "motion/react"
import {
  BookOpen,
  CreditCard,
  GraduationCap,
  Shield,
  Users,
  SearchX,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface FaqCategoriesProps {
  searchQuery: string
  activeCategory: string
}

const faqCategories = [
  {
    id: "plateforme",
    icon: GraduationCap,
    title: "Plateforme et Apprentissage",
    color: "from-blue-500 to-indigo-600",
    questions: [
      {
        q: "Qu'est-ce que NOMAQbanq ?",
        a: "NOMAQbanq est la première plateforme francophone de préparation à l'EACMC (Examen d'Aptitude du Conseil Médical du Canada) Partie I. Nous offrons une banque de questions complète, des examens blancs, et des outils d'apprentissage adaptés aux médecins diplômés à l'étranger.",
      },
      {
        q: "Comment fonctionne la plateforme ?",
        a: "Notre plateforme vous permet de vous entraîner avec des milliers de questions couvrant tous les domaines médicaux. Vous pouvez créer des examens personnalisés, suivre vos progrès, identifier vos points faibles et réviser avec des explications détaillées pour chaque question.",
      },
      {
        q: "Les questions sont-elles similaires à celles de l'EACMC ?",
        a: "Oui, nos questions sont conçues pour refléter le format, le niveau de difficulté et le contenu de l'EACMC Partie I. Elles sont régulièrement mises à jour et révisées par des médecins qualifiés pour garantir leur pertinence et leur qualité.",
      },
      {
        q: "Puis-je utiliser la plateforme sur mobile ?",
        a: "Absolument ! NOMAQbanq est entièrement responsive et fonctionne parfaitement sur tous les appareils : ordinateurs, tablettes et smartphones. Vous pouvez étudier où et quand vous voulez.",
      },
    ],
  },
  {
    id: "tarifs",
    icon: CreditCard,
    title: "Abonnements et Tarifs",
    color: "from-green-500 to-emerald-600",
    questions: [
      {
        q: "Quels sont les types d'accès disponibles ?",
        a: "Nous proposons deux types d'accès : l'Accès Examens (examens simulés en mode réaliste) et l'Accès Entraînement (banque de 5000+ questions avec mode tuteur). Chaque type est disponible en formule 1 mois (50 CAD) ou 6 mois (200 CAD, soit ~33% d'économie).",
      },
      {
        q: "Y a-t-il une période d'essai gratuite ?",
        a: "Oui ! Vous pouvez créer un compte gratuitement et tester notre section d'évaluation sans engagement. Cela vous permet de découvrir la plateforme avant d'acheter un accès complet.",
      },
      {
        q: "Comment fonctionne le temps cumulable ?",
        a: "Si vous prolongez votre accès avant son expiration, le temps restant s'ajoute à votre nouvel achat. Par exemple, s'il vous reste 15 jours et que vous achetez 30 jours, vous aurez 45 jours au total.",
      },
      {
        q: "Quels modes de paiement acceptez-vous ?",
        a: "Nous acceptons les cartes de crédit et débit (Visa, Mastercard, Amex) via Stripe, notre processeur de paiement sécurisé. L'accès est activé instantanément après le paiement.",
      },
    ],
  },
  {
    id: "contenu",
    icon: BookOpen,
    title: "Contenu et Domaines",
    color: "from-purple-500 to-pink-600",
    questions: [
      {
        q: "Combien de questions sont disponibles ?",
        a: "Notre banque contient plus de 5 000 questions couvrant tous les domaines de l'EACMC Partie I : médecine interne, chirurgie, pédiatrie, obstétrique-gynécologie, psychiatrie, et bien plus encore.",
      },
      {
        q: "Les questions sont-elles mises à jour régulièrement ?",
        a: "Oui, nous ajoutons de nouvelles questions chaque mois et mettons à jour le contenu existant pour refléter les dernières recommandations médicales et les changements dans l'examen.",
      },
      {
        q: "Y a-t-il des explications détaillées pour chaque question ?",
        a: "Chaque question est accompagnée d'une explication complète qui vous aide à comprendre non seulement la bonne réponse, mais aussi pourquoi les autres options sont incorrectes. C'est essentiel pour un apprentissage efficace.",
      },
      {
        q: "Puis-je créer mes propres examens personnalisés ?",
        a: "Oui ! Vous pouvez créer des examens sur mesure en choisissant les domaines, le nombre de questions, et le niveau de difficulté. C'est idéal pour cibler vos révisions sur vos points faibles.",
      },
    ],
  },
  {
    id: "securite",
    icon: Shield,
    title: "Sécurité et Confidentialité",
    color: "from-orange-500 to-red-600",
    questions: [
      {
        q: "Mes données personnelles sont-elles en sécurité ?",
        a: "Absolument. Nous utilisons un chiffrement de niveau bancaire pour protéger toutes vos données. Nous ne vendons jamais vos informations personnelles à des tiers et respectons strictement les réglementations sur la protection des données.",
      },
      {
        q: "Qui a accès à mes résultats d'examens ?",
        a: "Seul vous avez accès à vos résultats et à votre progression. Vos données sont strictement confidentielles et ne sont jamais partagées sans votre consentement explicite.",
      },
      {
        q: "Comment utilisez-vous les cookies ?",
        a: "Nous utilisons des cookies essentiels pour le fonctionnement du site et des cookies d'analyse (avec votre consentement) pour améliorer votre expérience. Consultez notre politique de cookies pour plus de détails.",
      },
    ],
  },
  {
    id: "support",
    icon: Users,
    title: "Support et Aide",
    color: "from-indigo-500 to-blue-600",
    questions: [
      {
        q: "Comment puis-je contacter le support ?",
        a: "Vous pouvez nous contacter par email à nomaqbanq@outlook.com ou par téléphone au +1 (438) 875-0746. Notre équipe répond généralement sous 24h.",
      },
      {
        q: "Y a-t-il une communauté d'utilisateurs ?",
        a: "Oui ! Nous avons des groupes actifs sur les réseaux sociaux où vous pouvez échanger avec d'autres candidats, partager des conseils et vous encourager mutuellement.",
      },
      {
        q: "Proposez-vous des ressources d'apprentissage supplémentaires ?",
        a: "En plus de notre banque de questions, nous publions régulièrement des articles, des guides de révision et des conseils stratégiques pour maximiser vos chances de réussite à l'examen.",
      },
      {
        q: "Puis-je obtenir un remboursement ?",
        a: "Nous offrons une garantie de satisfaction de 14 jours. Si vous n'êtes pas satisfait de la plateforme, contactez-nous dans les 14 premiers jours pour un remboursement complet.",
      },
    ],
  },
]

export const FaqCategories = ({
  searchQuery,
  activeCategory,
}: FaqCategoriesProps) => {
  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    return faqCategories
      .filter(
        (category) =>
          activeCategory === "all" || category.id === activeCategory
      )
      .map((category) => ({
        ...category,
        questions: category.questions.filter(
          (faq) =>
            !query ||
            faq.q.toLowerCase().includes(query) ||
            faq.a.toLowerCase().includes(query)
        ),
      }))
      .filter((category) => category.questions.length > 0)
  }, [searchQuery, activeCategory])

  const totalResults = filteredCategories.reduce(
    (acc, cat) => acc + cat.questions.length,
    0
  )

  if (filteredCategories.length === 0) {
    return (
      <section className="py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center rounded-2xl bg-gray-50 py-16 dark:bg-gray-800/50"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-200 dark:bg-gray-700">
              <SearchX className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              Aucun résultat trouvé
            </h3>
            <p className="text-center text-gray-500 dark:text-gray-400">
              Essayez avec d{"'"}autres termes de recherche ou changez de
              catégorie.
            </p>
          </motion.div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative py-12">
      {/* Background with depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-blue-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950/30" />

      {/* Subtle animated orbs */}
      <div className="absolute top-20 -left-32 h-64 w-64 rounded-full bg-gradient-to-br from-blue-200/40 to-indigo-300/40 blur-3xl dark:from-blue-900/20 dark:to-indigo-900/20" />
      <div className="absolute bottom-40 -right-32 h-72 w-72 rounded-full bg-gradient-to-br from-purple-200/40 to-pink-300/40 blur-3xl dark:from-purple-900/20 dark:to-pink-900/20" />
      <div className="absolute top-1/2 left-1/4 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-200/30 to-teal-300/30 blur-3xl dark:from-emerald-900/15 dark:to-teal-900/15" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Results count */}
        {searchQuery && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 text-sm text-gray-500 dark:text-gray-400"
          >
            {totalResults} résultat{totalResults > 1 ? "s" : ""} trouvé
            {totalResults > 1 ? "s" : ""}
          </motion.p>
        )}

        <div className="space-y-10">
          {filteredCategories.map((category, categoryIdx) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: categoryIdx * 0.1 }}
            >
              {/* Category Header */}
              <div className="mb-6 flex items-center gap-4">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${category.color} shadow-lg`}
                >
                  <category.icon className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {category.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {category.questions.length} question
                    {category.questions.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Questions Accordion */}
              <Accordion
                type="single"
                collapsible
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                {category.questions.map((faq, faqIdx) => (
                  <AccordionItem
                    key={faqIdx}
                    value={`item-${category.id}-${faqIdx}`}
                    className="border-b border-gray-200 px-6 last:border-b-0 dark:border-gray-800"
                  >
                    <AccordionTrigger className="cursor-pointer py-5 text-left text-base font-semibold text-gray-900 hover:text-blue-600 hover:no-underline dark:text-white dark:hover:text-blue-400">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 text-gray-600 dark:text-gray-400">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
