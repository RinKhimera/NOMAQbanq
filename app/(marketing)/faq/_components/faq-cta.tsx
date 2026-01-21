"use client"

import { motion } from "motion/react"
import { Mail, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"

export const FaqCta = () => {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800" />
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
          {/* Icon */}
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-sm">
            <Mail className="h-10 w-10 text-white" />
          </div>

          <h2 className="font-display text-display-md mb-6 text-white">
            Vous ne trouvez pas votre réponse ?
          </h2>
          <p className="text-body-lg mx-auto mb-10 max-w-2xl text-blue-100">
            Notre équipe est là pour vous aider. Contactez-nous et nous vous
            répondrons dans les plus brefs délais.
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-14 rounded-2xl bg-white px-10 text-base font-bold text-blue-600 shadow-xl transition-all duration-300 hover:scale-105 hover:bg-blue-50 hover:shadow-2xl"
            >
              <a href="mailto:nomaqbanq@outlook.com">
                <Mail className="mr-2 h-5 w-5" />
                Envoyer un email
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="glass-card-dark h-14 rounded-2xl border-2 border-white/30 px-10 text-base font-bold text-white transition-all duration-300 hover:bg-white/10"
            >
              <a href="tel:+14388750746">
                <Phone className="mr-2 h-5 w-5" />
                Appeler le support
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
