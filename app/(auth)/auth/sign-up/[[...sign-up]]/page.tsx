"use client"

import { SignUp } from "@clerk/nextjs"
import { Sparkles, Star, CheckCircle, Award, Shield } from "lucide-react"
import Image from "next/image"

export default function InscriptionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[700px]">
          {/* Left side - Hero content */}
          <div className="space-y-10 animate-slide-in-left">
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold border border-green-200/50 dark:border-green-700/50">
              <Sparkles className="h-4 w-4 mr-2" />
              Commencez gratuitement
            </div>

            <div className="space-y-8">
              <h1 className="font-display text-display-lg text-gray-900 dark:text-white leading-tight">
                Commencez à transformer vos
                <span className="block gradient-text">
                  connaissances en réalité.
                </span>
              </h1>

              <p className="text-body-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-lg">
                Créez un compte gratuit et obtenez un accès complet à toutes les
                fonctionnalités pendant 30 jours. Aucune carte de crédit
                nécessaire. Approuvé par plus de 4 000 professionnels.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Essai gratuit de 30 jours
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Accès complet sans engagement
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Contenu certifié EACMC
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Questions validées par des experts
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Données sécurisées
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Protection maximale de vos informations
                  </p>
                </div>
              </div>
            </div>

            {/* Reviews */}
            <div className="glass-card rounded-2xl p-6 border border-blue-100 dark:border-blue-800">
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Image
                      key={i}
                      src={`https://images.pexels.com/photos/532727${i}/pexels-photo-532727${i}.jpeg?auto=compress&cs=tinysrgb&w=60`}
                      alt={`User ${i}`}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-2xl border-2 border-white dark:border-gray-800 object-cover shadow-lg"
                    />
                  ))}
                </div>
                <div>
                  <div className="flex items-center space-x-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 text-yellow-400 fill-current"
                      />
                    ))}
                    <span className="text-gray-900 dark:text-white font-semibold ml-2">
                      5.0
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    de plus de 200+ avis
                  </p>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm italic leading-relaxed">
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
