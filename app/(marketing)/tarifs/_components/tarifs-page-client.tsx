"use client"

import { motion } from "motion/react"
import { ArrowRight, Shield, Zap, Clock, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PricingHeader } from "./pricing-header"
import { PricingGrid } from "./pricing-grid"

const guarantees = [
  {
    icon: Shield,
    title: "Paiement sécurisé",
    description: "Vos transactions sont protégées par Stripe",
  },
  {
    icon: Zap,
    title: "Accès instantané",
    description: "Commencez immédiatement après le paiement",
  },
  {
    icon: Clock,
    title: "Temps cumulable",
    description: "Prolongez votre accès à tout moment",
  },
  {
    icon: RefreshCw,
    title: "Contenu mis à jour",
    description: "Questions actualisées régulièrement",
  },
]

export default function TarifsPageClient() {
  return (
    <>
      {/* Header section */}
      <PricingHeader />

      {/* Pricing cards */}
      <PricingGrid />

      {/* Guarantees section */}
      <section className="py-20 bg-linear-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-display-md text-gray-900 dark:text-white mb-4">
              Pourquoi nous faire confiance ?
            </h2>
            <p className="text-body-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Nous nous engageons à vous offrir la meilleure expérience de préparation à l{"'"}EACMC.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {guarantees.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-gray-800"
              >
                {/* Gradient accent on hover */}
                <div className="absolute inset-0 bg-linear-to-br from-blue-600/5 to-indigo-600/5 opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-lg">
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-linear-to-br from-blue-600 via-indigo-700 to-purple-800" />
        <div className="absolute inset-0 bg-black/20" />

        {/* Animated background */}
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-float" />
        <div
          className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-display-md mb-6 text-white">
              Prêt à commencer votre préparation ?
            </h2>
            <p className="text-body-lg mx-auto mb-10 max-w-2xl text-blue-100">
              Rejoignez des milliers de candidats qui ont réussi grâce à NOMAQbanq.
              Commencez dès maintenant avec un accès instantané.
            </p>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/auth/sign-up">
                <Button
                  size="lg"
                  className="h-14 rounded-2xl bg-white px-10 text-base font-bold text-blue-600 shadow-xl transition-all duration-300 hover:scale-105 hover:bg-blue-50 hover:shadow-2xl"
                >
                  Créer un compte gratuit
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/evaluation">
                <Button
                  size="lg"
                  variant="outline"
                  className="glass-card-dark h-14 rounded-2xl border-2 border-white/30 px-10 text-base font-bold text-white transition-all duration-300 hover:bg-white/10"
                >
                  Essayer gratuitement
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
