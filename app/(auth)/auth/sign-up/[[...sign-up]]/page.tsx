"use client"

import { Badge } from "@/components/ui/badge"
import { SignUp } from "@clerk/nextjs"
import { Award, CheckCircle, Shield, Sparkles, Star } from "lucide-react"
import Image from "next/image"

export default function InscriptionPage() {
  return (
    <div className="theme-bg min-h-screen pt-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid min-h-[700px] items-center gap-16 lg:grid-cols-2">
          {/* Left side - Hero content */}
          <div className="animate-slide-in-left space-y-10">
            <Badge variant="success_badge" className="mb-8 px-6 py-3 text-sm font-semibold">
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

          {/* Right side - SignUp component */}
          <div
            className="animate-slide-in-right flex justify-center"
            style={{ animationDelay: "0.2s" }}
          >
            <SignUp path="/auth/sign-up" />
          </div>
        </div>
      </div>
    </div>
  )
}
