"use client"

import { motion } from "motion/react"
import { HelpCircle, MessageCircle, Shield, Clock, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export const FaqHeader = () => {
  const stats = [
    { icon: MessageCircle, value: "20+", label: "Questions répondues" },
    { icon: Clock, value: "24h", label: "Temps de réponse" },
    { icon: Shield, value: "100%", label: "Données sécurisées" },
  ]

  return (
    <section className="relative overflow-hidden pt-8 pb-16">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/20" />

      {/* Animated orbs */}
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-600/20 blur-3xl animate-float" />
      <div
        className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-600/20 blur-3xl animate-float"
        style={{ animationDelay: "2s" }}
      />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="badge" className="mb-8 px-6 py-3 text-sm font-semibold">
              <HelpCircle className="mr-2 h-4 w-4" />
              Centre d{"'"}aide
            </Badge>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-display-lg mb-6 text-gray-900 dark:text-white"
          >
            Foire Aux{" "}
            <span className="gradient-text">Questions</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-body-lg mx-auto max-w-2xl text-gray-600 dark:text-gray-300"
          >
            Trouvez rapidement des réponses à toutes vos questions sur NOMAQbanq,
            la préparation à l{"'"}EACMC, et notre plateforme d{"'"}apprentissage.
          </motion.p>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-8"
          >
            {stats.map((stat, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-2xl bg-white/80 px-5 py-3 shadow-lg backdrop-blur dark:bg-gray-800/80"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Rating */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex items-center justify-center gap-2"
          >
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="h-5 w-5 fill-current text-yellow-400"
                />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Support noté 5/5 par nos utilisateurs
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
