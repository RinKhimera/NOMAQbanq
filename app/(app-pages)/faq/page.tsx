import {
  BookOpen,
  CreditCard,
  FileQuestion,
  GraduationCap,
  HelpCircle,
  Lock,
  Mail,
  Shield,
  Users,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function FAQPage() {
  const faqCategories = [
    {
      icon: GraduationCap,
      title: "Plateforme et Apprentissage",
      color: "from-blue-600 to-indigo-600",
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
      icon: CreditCard,
      title: "Abonnements et Tarifs",
      color: "from-green-600 to-emerald-600",
      questions: [
        {
          q: "Quels sont les plans d'abonnement disponibles ?",
          a: "Nous proposons plusieurs plans adaptés à vos besoins : un plan mensuel pour une préparation courte durée, un plan trimestriel pour un meilleur rapport qualité-prix, et un plan annuel pour une préparation complète avec le maximum d'économies.",
        },
        {
          q: "Y a-t-il une période d'essai gratuite ?",
          a: "Oui ! Nous offrons un accès gratuit à une sélection de questions pour que vous puissiez tester la plateforme avant de vous abonner. Inscrivez-vous simplement pour commencer.",
        },
        {
          q: "Comment puis-je annuler mon abonnement ?",
          a: "Vous pouvez annuler votre abonnement à tout moment depuis votre espace personnel dans les paramètres du compte. L'annulation prendra effet à la fin de votre période de facturation en cours.",
        },
        {
          q: "Quels modes de paiement acceptez-vous ?",
          a: "Nous acceptons les cartes de crédit (Visa, Mastercard, American Express), les cartes de débit, et d'autres moyens de paiement sécurisés via notre processeur de paiement Stripe.",
        },
      ],
    },
    {
      icon: BookOpen,
      title: "Contenu et Domaines",
      color: "from-purple-600 to-pink-600",
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
      icon: Shield,
      title: "Sécurité et Confidentialité",
      color: "from-red-600 to-orange-600",
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
      icon: Users,
      title: "Support et Aide",
      color: "from-indigo-600 to-blue-600",
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-20 dark:from-gray-950 dark:to-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-20 dark:border-gray-800 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl dark:bg-blue-600/10"></div>
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-purple-400/10 blur-3xl dark:bg-purple-600/10"></div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1.5 text-sm font-semibold text-white">
              Centre d&apos;aide
            </Badge>
            <h1 className="mb-6 text-4xl font-extrabold text-gray-900 sm:text-5xl lg:text-6xl dark:text-white">
              Foire Aux Questions
            </h1>
            <p className="mx-auto max-w-3xl text-lg text-gray-600 dark:text-gray-400">
              Trouvez rapidement des réponses à toutes vos questions sur
              NOMAQbanq, la préparation à l&apos;EACMC, et notre plateforme
              d&apos;apprentissage.
            </p>

            {/* Quick stats */}
            <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-4">
              {[
                { icon: FileQuestion, label: "25+ Questions", color: "blue" },
                { icon: Users, label: "Support 24/7", color: "green" },
                { icon: Shield, label: "100% Sécurisé", color: "purple" },
                {
                  icon: HelpCircle,
                  label: "Réponses Rapides",
                  color: "indigo",
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-gray-200 bg-white/50 p-4 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/50"
                >
                  <stat.icon
                    className={`mx-auto mb-2 h-8 w-8 text-${stat.color}-600`}
                  />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {faqCategories.map((category, categoryIdx) => (
              <div key={categoryIdx}>
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
                      {category.questions.length} questions
                    </p>
                  </div>
                </div>

                {/* Questions Accordion */}
                <Accordion
                  type="single"
                  collapsible
                  className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                >
                  {category.questions.map((faq, faqIdx) => (
                    <AccordionItem
                      key={faqIdx}
                      value={`item-${categoryIdx}-${faqIdx}`}
                      className="rounded-xl border border-gray-200 px-4 dark:border-gray-800"
                    >
                      <AccordionTrigger className="text-left text-base font-semibold text-gray-900 hover:text-blue-600 hover:no-underline dark:text-white dark:hover:text-blue-400">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600 dark:text-gray-400">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>

          {/* Contact CTA */}
          <div className="mt-20 rounded-3xl border border-gray-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-12 text-center dark:border-gray-800 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
              Vous ne trouvez pas votre réponse ?
            </h3>
            <p className="mb-8 text-gray-600 dark:text-gray-400">
              Notre équipe est là pour vous aider. Contactez-nous et nous vous
              répondrons dans les plus brefs délais.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                asChild
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-base font-semibold shadow-lg hover:from-blue-700 hover:to-indigo-700"
              >
                <a href="mailto:nomaqbanq@outlook.com">
                  <Mail className="mr-2 h-5 w-5" />
                  Envoyer un email
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-2 px-8 py-6 text-base font-semibold"
              >
                <a href="tel:+14388750746">
                  <Lock className="mr-2 h-5 w-5" />
                  Appeler le support
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
