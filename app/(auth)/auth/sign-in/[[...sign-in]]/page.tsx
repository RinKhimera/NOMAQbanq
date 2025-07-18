"use client"

import { SignIn } from "@clerk/nextjs"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, Shield, Zap } from "lucide-react"
import Image from "next/image"

export default function ConnexionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[700px]">
          {/* Left side - Welcome back content */}
          <div className="space-y-10 animate-slide-in-left">
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold border border-blue-200/50 dark:border-blue-700/50">
              <Sparkles className="h-4 w-4 mr-2" />
              Bon retour parmi nous
            </div>

            <div className="space-y-8">
              <h1 className="font-display text-display-lg text-gray-900 dark:text-white leading-tight">
                Bon retour !
                <span className="block gradient-text">Continuez votre</span>
                <span className="block gradient-text">apprentissage.</span>
              </h1>

              <p className="text-body-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-lg">
                Connectez-vous à votre compte NOMAQbank et reprenez votre
                préparation à l&apos;EACMC là où vous vous êtes arrêté.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Sécurisé et fiable
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Vos données sont protégées
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Accès instantané
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    À toutes vos ressources
                  </p>
                </div>
              </div>
            </div>

            {/* Success story */}
            <div className="glass-card rounded-2xl p-6 max-w-md border border-blue-100 dark:border-blue-800">
              <div className="flex items-center space-x-4 mb-4">
                <Image
                  src="https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=60"
                  alt="Success story"
                  width={60}
                  height={60}
                  className="w-14 h-14 rounded-2xl object-cover shadow-lg"
                />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Dr. Marie Dubois
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                    Résidente en médecine
                  </p>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm italic leading-relaxed">
                &quot;NOMAQbank m&apos;a aidée à réussir l&apos;EACMC du premier
                coup. Une plateforme indispensable !&quot;
              </p>
            </div>

            <div className="text-center lg:text-left">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Nouveau sur NOMAQbank ?
              </p>
              <Link href="/auth/sign-up">
                <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold px-8 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 btn-modern">
                  Créer un compte gratuit
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Right side - SignIn component */}
          <div
            className="animate-slide-in-right flex justify-center"
            style={{ animationDelay: "0.2s" }}
          >
            <SignIn path="/auth/sign-in" />
          </div>
        </div>
      </div>
    </div>
  )
}
