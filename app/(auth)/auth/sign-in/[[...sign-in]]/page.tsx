"use client"

import { SignIn } from "@clerk/nextjs"
import { ArrowRight, Shield, Sparkles, Zap } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function ConnexionPage() {
  return (
    <div className="theme-bg min-h-screen pt-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid min-h-[700px] items-center gap-16 lg:grid-cols-2">
          {/* Left side - Welcome back content */}
          <div className="animate-slide-in-left space-y-10">
            <Badge
              variant="badge"
              className="mb-8 px-6 py-3 text-sm font-semibold"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Bon retour parmi nous
            </Badge>

            <div className="space-y-8">
              <h1 className="font-display text-display-lg leading-tight text-gray-900 dark:text-white">
                Bon retour !
                <span className="gradient-text block">Continuez votre</span>
                <span className="gradient-text block">apprentissage.</span>
              </h1>

              <p className="text-body-lg max-w-lg leading-relaxed text-gray-600 dark:text-gray-300">
                Connectez-vous à votre compte NOMAQbank et reprenez votre
                préparation à l&apos;EACMC là où vous vous êtes arrêté.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Sécurisé et fiable
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Vos données sont protégées
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Accès instantané
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    À toutes vos ressources
                  </p>
                </div>
              </div>
            </div>

            {/* Success story */}
            <div className="glass-card max-w-md rounded-2xl border border-blue-100 p-6 dark:border-blue-800">
              <div className="mb-4 flex items-center space-x-4">
                <Image
                  src="https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=60"
                  alt="Success story"
                  width={60}
                  height={60}
                  className="h-14 w-14 rounded-2xl object-cover shadow-lg"
                />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Dr. Marie Dubois
                  </p>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Résidente en médecine
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-gray-700 italic dark:text-gray-300">
                &quot;NOMAQbank m&apos;a aidée à réussir l&apos;EACMC du premier
                coup. Une plateforme indispensable !&quot;
              </p>
            </div>

            <div className="text-center lg:text-left">
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Nouveau sur NOMAQbank ?
              </p>
              <Link href="/auth/sign-up">
                <Button className="btn-modern transform rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:from-green-700 hover:to-emerald-700 hover:shadow-xl">
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
