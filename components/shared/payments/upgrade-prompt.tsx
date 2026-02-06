"use client"

import { motion } from "motion/react"
import { Lock, Sparkles, Zap, ArrowRight, Shield } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface UpgradePromptProps {
  accessType: "exam" | "training"
  feature?: string
  className?: string
}

const typeConfig = {
  exam: {
    title: "Accès aux examens requis",
    description: "Débloquez l'accès aux examens simulés pour tester vos connaissances dans des conditions réelles.",
    icon: Zap,
    gradient: "from-blue-600 via-indigo-600 to-violet-600",
    lightGradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
    features: [
      "Examens blancs chronométrés",
      "Conditions d'examen réalistes",
      "Correction détaillée",
      "Statistiques de performance",
    ],
  },
  training: {
    title: "Accès à l'entraînement requis",
    description: "Débloquez l'accès à la banque d'entraînement pour vous exercer à votre rythme.",
    icon: Sparkles,
    gradient: "from-emerald-600 via-teal-600 to-cyan-600",
    lightGradient: "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
    features: [
      "5000+ questions d'entraînement",
      "Mode tuteur avec explications",
      "Filtrage par domaine",
      "Progression personnalisée",
    ],
  },
}

export const UpgradePrompt = ({
  accessType,
  feature,
  className,
}: UpgradePromptProps) => {
  const config = typeConfig[accessType]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-gray-200/50 bg-white p-8 shadow-2xl dark:border-gray-700/50 dark:bg-gray-900",
        className
      )}
    >
      {/* Background gradient */}
      <div className={cn(
        "absolute inset-0 opacity-[0.03] dark:opacity-[0.08]",
        "bg-linear-to-br",
        config.gradient
      )} />

      {/* Decorative elements */}
      <div className={cn(
        "absolute -right-16 -top-16 h-32 w-32 rounded-full blur-3xl opacity-40",
        "bg-linear-to-br",
        config.gradient
      )} />
      <div className={cn(
        "absolute -left-16 -bottom-16 h-32 w-32 rounded-full blur-3xl opacity-20",
        "bg-linear-to-br",
        config.gradient
      )} />

      <div className="relative mx-auto max-w-lg text-center">
        {/* Lock icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="mx-auto mb-6"
        >
          <div className={cn(
            "relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl",
            "bg-linear-to-br shadow-lg",
            config.gradient
          )}>
            <Lock className="h-10 w-10 text-white" />
            {/* Animated ring */}
            <div className={cn(
              "absolute inset-0 rounded-2xl opacity-50 animate-ping",
              "bg-linear-to-br",
              config.gradient
            )} />
          </div>
        </motion.div>

        {/* Title & Description */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-3 text-2xl font-bold text-gray-900 dark:text-white"
        >
          {config.title}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-8 text-gray-600 dark:text-gray-400"
        >
          {feature ? `Pour accéder à "${feature}", vous avez besoin d'un abonnement actif.` : config.description}
        </motion.p>

        {/* Features list */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={cn(
            "mb-8 rounded-2xl p-6",
            "bg-linear-to-br",
            config.lightGradient
          )}
        >
          <div className="grid gap-3 text-left sm:grid-cols-2">
            {config.features.map((feat, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  "bg-linear-to-br",
                  config.gradient
                )}>
                  <Icon className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {feat}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="space-y-4"
        >
          <Link href="/tarifs">
            <Button
              size="lg"
              className={cn(
                "h-14 w-full rounded-2xl text-base font-bold text-white shadow-lg",
                "bg-linear-to-r hover:opacity-90",
                config.gradient
              )}
            >
              <span className="flex items-center gap-2">
                Voir les tarifs
                <ArrowRight className="h-5 w-5" />
              </span>
            </Button>
          </Link>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Shield className="h-4 w-4" />
            Paiement sécurisé · Accès instantané
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
