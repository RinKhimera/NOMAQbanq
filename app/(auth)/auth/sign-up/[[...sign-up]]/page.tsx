"use client"

import { SignUp } from "@clerk/nextjs"
import { Award, CheckCircle, Shield, Sparkles, Star } from "lucide-react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"

export default function InscriptionPage() {
  return (
    <div className="theme-bg">
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-12 sm:px-6 lg:px-8">
        <div className="grid min-h-[700px] items-center gap-16 lg:grid-cols-2">
          {/* Left side - Hero content - Hidden on mobile, shown on desktop */}
          <div className="animate-slide-in-left hidden space-y-10 lg:block">
            <Badge
              variant="success_badge"
              className="mb-8 px-6 py-3 text-sm font-semibold"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Commencez gratuitement
            </Badge>

            <div className="space-y-8">
              <h1 className="font-display text-display-lg leading-tight text-gray-900 dark:text-white">
                Commencez à transformer vos
                <span className="gradient-text block">
                  connaissances en réalité.
                </span>
              </h1>

              <p className="text-body-lg max-w-lg leading-relaxed text-gray-600 dark:text-gray-300">
                Créez un compte gratuit et obtenez un accès complet à toutes les
                fonctionnalités pendant 30 jours. Aucune carte de crédit
                nécessaire. Approuvé par plus de 4 000 professionnels.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Essai gratuit de 30 jours
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Accès complet sans engagement
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Contenu certifié EACMC
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Questions validées par des experts
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Données sécurisées
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Protection maximale de vos informations
                  </p>
                </div>
              </div>
            </div>

            {/* Reviews */}
            <div className="glass-card rounded-2xl border border-blue-100 p-6 dark:border-blue-800">
              <div className="mb-4 flex items-center space-x-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Image
                      key={i}
                      src={`https://images.pexels.com/photos/532727${i}/pexels-photo-532727${i}.jpeg?auto=compress&cs=tinysrgb&w=60`}
                      alt={`User ${i}`}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-2xl border-2 border-white object-cover shadow-lg dark:border-gray-800"
                    />
                  ))}
                </div>
                <div>
                  <div className="mb-1 flex items-center space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-current text-yellow-400"
                      />
                    ))}
                    <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                      5.0
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    de plus de 200+ avis
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-gray-700 italic dark:text-gray-300">
                &quot;Une plateforme exceptionnelle qui m&apos;a permis de
                réussir l&apos;EACMC du premier coup !&quot;
              </p>
            </div>
          </div>

          {/* Right side - SignUp component with decorative background - Shown first on mobile */}
          <div
            className="animate-slide-in-right relative order-first lg:order-last"
            style={{ animationDelay: "0.2s" }}
          >
            {/* Decorative background elements */}
            <div className="absolute -top-10 -right-10 h-72 w-72 rounded-full bg-gradient-to-br from-green-400/20 to-emerald-400/20 blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 h-64 w-64 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-400/20 blur-3xl"></div>

            {/* Card container */}
            <div className="relative z-10 flex flex-col items-center rounded-3xl border border-white/20 bg-white/60 p-8 shadow-2xl backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/60">
              <div className="mb-6 w-full text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                  Commencez gratuitement
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Créez votre compte en quelques secondes
                </p>
              </div>

              <div className="flex w-full justify-center">
                <SignUp path="/auth/sign-up" />
              </div>

              {/* Benefits footer */}
              <div className="mt-6 w-full space-y-3 border-t border-gray-200 pt-6 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Aucune carte de crédit requise</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span>
                    Vos données sont protégées par un chiffrement de niveau
                    bancaire
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
