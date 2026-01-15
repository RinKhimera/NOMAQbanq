"use client"

import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle,
  Play,
  RefreshCw,
  Settings,
  Star,
  Target,
  Timer,
  Trophy,
  Zap,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function HomeLanding() {
  // Features section data
  const features = [
    {
      icon: Play,
      title: "Démarrage instantané",
      description:
        "Après avoir créé des questions sur un sujet de votre choix, vous pouvez commencer immédiatement en mode tuteur ou chronométré",
    },
    {
      icon: BookOpen,
      title: "Points de synthèse",
      description:
        "À la fin de chaque cas clinique présenté, les caractéristiques clés et les concepts cliniques importants sont résumés pour un rappel rapide",
    },
    {
      icon: Timer,
      title: "Modes chronométré / tuteur",
      description:
        "Selon votre emploi du temps et votre objectif ultime de préparation à l'examen EACMC partie 1, vous pouvez choisir entre le mode chronométré ou le mode tuteur",
    },
    {
      icon: Target,
      title: "Disciplines",
      description:
        "Les disciplines (matières cliniques) sont placées dans un ordre systématique pour vous permettre de tester vos connaissances dans un domaine spécifique ou de réviser un sujet particulier",
    },
    {
      icon: BarChart3,
      title: "Suivi des performances",
      description:
        "Quel que soit le mode chronométré ou tuteur lors de l&apos;utilisation de la banque de questions, une série de commentaires sont fournis pour améliorer les performances de l&apos;utilisateur",
    },
    {
      icon: Settings,
      title: "Niveaux de difficulté",
      description:
        "Il y a une combinaison de questions de niveau facile à avancé et des questions piège sont mélangées pour une meilleure préparation à l'examen EACMC partie 1",
    },
    {
      icon: RefreshCw,
      title: "Mise à jour",
      description:
        "Les questions, points de synthèse et algorithmes sont tous sous révision continue pour fournir une source fiable pour les préparations EACMC partie 1",
    },
    {
      icon: Brain,
      title: "Moyens mnémotechniques",
      description:
        "De nombreux moyens mnémotechniques présents pour résumer les points cliniques à haut rendement en un seul mot et faciliter leur rappel pendant l'examen",
    },
  ]

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
      {/* Hero Section - Ultra modern */}
      <section className="relative overflow-hidden pt-8 pb-32">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="animate-float absolute -top-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-600/20 blur-3xl"></div>
          <div
            className="animate-float absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-600/20 blur-3xl"
            style={{ animationDelay: "2s" }}
          ></div>
          <div className="absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-gradient-to-br from-blue-500/5 to-indigo-600/5 blur-3xl"></div>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid min-h-[700px] items-center gap-16 lg:grid-cols-2">
            {/* Left content */}
            <div className="animate-fade-in-up space-y-10">
              <div className="space-y-8">
                <div className="inline-flex items-center rounded-full border border-blue-200/50 bg-gradient-to-r from-blue-100 to-indigo-100 px-4 py-2 text-sm font-semibold text-blue-700 dark:border-blue-700/50 dark:from-blue-900/50 dark:to-indigo-900/50 dark:text-blue-300">
                  <Award className="mr-2 h-4 w-4" />
                  Plateforme #1 pour l&apos;EACMC
                </div>

                <h1 className="font-display text-display-xl gradient-text leading-none">
                  PRÉPAREZ-VOUS
                  <span className="block">SANS</span>
                  <span className="block">LIMITES</span>
                </h1>

                <p className="text-body-lg max-w-lg leading-relaxed text-gray-600 dark:text-gray-300">
                  Développez vos compétences médicales grâce à des QCM, des
                  simulations et des évaluations en ligne proposés par les
                  meilleurs professionnels francophones au Canada.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Link href="/auth/sign-up">
                  <Button
                    variant="btn_modern"
                    className="btn-modern h-auto transform rounded-2xl px-8 py-4 text-lg font-semibold shadow-xl transition-all duration-300"
                  >
                    Inscrivez-vous gratuitement
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/evaluation">
                  <Button
                    variant="btn_secondary"
                    className="glass-card h-auto rounded-2xl px-8 py-4 text-lg font-semibold transition-all duration-300"
                  >
                    Essayez NOMAQbanq
                    <Play className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center space-x-8 pt-8">
                <div className="flex items-center space-x-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-10 w-10 rounded-full border-2 border-white bg-gradient-to-br from-blue-400 to-indigo-600 dark:border-gray-800"
                      ></div>
                    ))}
                  </div>
                  <div className="ml-3">
                    <div className="flex items-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className="h-4 w-4 fill-current text-yellow-400"
                        />
                      ))}
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      2000+ candidats satisfaits
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right content - Modern hero image */}
            <div className="animate-slide-in-right relative justify-end lg:flex">
              <div className="relative">
                {/* Main image container */}
                <div className="glass-card relative z-10 rounded-3xl p-2 shadow-2xl">
                  <Image
                    src="/images/home-image.jpg"
                    alt="Jeune médecin confiant portant une blouse blanche"
                    className="h-[500px] w-full rounded-2xl object-cover"
                    width={500}
                    height={500}
                    priority
                  />
                </div>

                {/* Floating elements */}
                <div className="glass-card animate-float absolute -top-6 -left-6 z-20 rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-400 to-emerald-600">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Certifié EACMC
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Contenu validé
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="glass-card animate-float absolute -right-6 -bottom-6 z-20 rounded-2xl p-4 shadow-lg"
                  style={{ animationDelay: "1s" }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600">
                      <Trophy className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        85% de réussite
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Taux de succès
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-card animate-pulse-glow absolute top-1/2 -left-12 z-20 rounded-xl p-3 shadow-lg">
                  <div className="flex items-center space-x-2">
                    <Star className="h-5 w-5 fill-current text-yellow-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      4.9/5
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Ultra modern cards */}
      <section className="section-modern bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="animate-fade-in-up mb-20 text-center">
            <Badge
              variant="badge"
              className="mb-8 px-6 py-3 text-sm font-semibold"
            >
              <Zap className="mr-2 h-4 w-4" />
              Fonctionnalités
            </Badge>
            <h2 className="font-display text-display-lg mb-6 text-gray-900 dark:text-white">
              Tout ce dont vous avez besoin pour améliorer vos performances en
              un seul endroit
            </h2>
            <p className="text-body-lg mx-auto max-w-3xl text-gray-600 dark:text-gray-300">
              Une suite complète d&apos;outils conçue pour maximiser votre
              réussite à l&apos;EACMC
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="card-feature animate-fade-in-scale"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - Modern and attractive */}
      <section className="section-modern bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-20 lg:grid-cols-2">
            {/* Left side - Content */}
            <div className="animate-slide-in-left space-y-8">
              <div className="inline-flex items-center rounded-full border border-green-200/50 bg-gradient-to-r from-green-100 to-emerald-100 px-6 py-3 text-sm font-semibold text-green-700 dark:border-green-700/50 dark:from-green-900/50 dark:to-emerald-900/50 dark:text-green-300">
                <BookOpen className="mr-2 h-4 w-4" />
                BANQUE DE QUESTIONS
              </div>

              <div className="space-y-6">
                <h2 className="font-display text-display-lg leading-tight text-gray-900 dark:text-white">
                  Inscrivez-vous pour les questions NOMAQbanq
                </h2>

                <p className="text-body-lg leading-relaxed text-gray-600 dark:text-gray-300">
                  Lors de la préparation à l&apos;examen EACMC partie 1, il est
                  essentiel de réviser les objectifs du Conseil médical du
                  Canada (CMC). Les objectifs décrivent les qualités requises
                  des diplômés en médecine et des diplômés médicaux
                  internationaux (DMI) qui cherchent à entrer en résidence au
                  Canada.
                </p>

                <p className="text-body leading-relaxed text-gray-600 dark:text-gray-300">
                  En vous familiarisant minutieusement avec les objectifs du
                  CMC, vous pouvez vous assurer d&apos;être adéquatement préparé
                  à répondre aux attentes de la profession médicale. NOMAQbanq
                  contient plus de 2800+ questions basées sur les objectifs du
                  CMC, fournissant un contenu à haut rendement pour vous aider à
                  réussir vos examens.
                </p>
              </div>

              <Link href="/evaluation">
                <Button
                  variant="btn_modern"
                  className="btn-modern h-auto transform rounded-2xl px-8 py-4 text-lg font-semibold shadow-xl transition-all duration-300"
                >
                  ESSAYEZ GRATUITEMENT
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>

            {/* Right side - Pricing card */}
            <div
              className="animate-slide-in-right"
              style={{ animationDelay: "0.2s" }}
            >
              <div className="relative">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 opacity-25 blur"></div>
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-2xl">
                  <div className="absolute top-0 right-0 h-32 w-32 translate-x-16 -translate-y-16 rounded-full bg-white/10"></div>
                  <div className="absolute bottom-0 left-0 h-24 w-24 -translate-x-12 translate-y-12 rounded-full bg-white/10"></div>

                  <div className="relative z-10">
                    <div className="mb-8 flex items-start justify-between">
                      <div className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
                        PLUS DE 2800+ QUESTIONS
                      </div>
                    </div>

                    {/* <div className="mb-8">
                      <div className="mb-2 flex items-baseline">
                        <span className="text-6xl font-bold">339$</span>
                        <span className="ml-2 text-xl text-blue-100">
                          /3 Mois
                        </span>
                      </div>
                      <p className="text-blue-100">
                        Accès complet à la plateforme
                      </p>
                    </div> */}

                    <div className="mb-8 space-y-4">
                      {[
                        "Banque de questions pour 3 mois",
                        "Basé sur les objectifs CMC",
                        "Explications simples",
                        "Moyens mnémotechniques mémorables",
                        "Tableaux de synthèse et algorithmes",
                        "Apprentissage à rythme personnalisé",
                      ].map((feature, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3"
                        >
                          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-400">
                            <CheckCircle className="h-3 w-3 text-green-900" />
                          </div>
                          <span className="text-blue-50">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Link href="/auth/sign-up">
                      <Button className="btn-modern w-full cursor-pointer rounded-2xl bg-white py-4 font-semibold text-blue-600 shadow-lg transition-all duration-300 hover:bg-blue-50 hover:shadow-xl">
                        S&apos;inscrire maintenant
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Modern gradient */}
      <section className="relative overflow-hidden py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800"></div>
        <div className="absolute inset-0 bg-black/20"></div>

        {/* Animated background elements */}
        <div className="absolute top-0 left-0 h-full w-full overflow-hidden">
          <div className="animate-float absolute -top-40 -left-40 h-80 w-80 rounded-full bg-white/10 blur-3xl"></div>
          <div
            className="animate-float absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-white/10 blur-3xl"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <div className="animate-fade-in-up">
            <h2 className="font-display text-display-lg mb-8 text-white">
              Commencez votre préparation dès aujourd&apos;hui
            </h2>
            <p className="text-body-lg mx-auto mb-12 max-w-2xl text-blue-100">
              Rejoignez les milliers de candidats qui ont réussi grâce à
              NOMAQbanq
            </p>
            <div className="flex flex-col justify-center gap-6 sm:flex-row">
              <Link href="/auth/sign-up">
                <Button className="btn-modern h-auto transform rounded-2xl bg-white px-12 py-4 text-lg font-semibold text-blue-600 shadow-xl transition-all duration-300 hover:scale-105 hover:bg-blue-50 hover:shadow-2xl">
                  Inscription gratuite
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button
                variant="outline"
                className="glass-card-dark h-auto rounded-2xl border-2 border-white/30 px-12 py-4 text-lg font-semibold text-white transition-all duration-300 hover:bg-white/10"
              >
                Voir les tarifs
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer moved to MainLayout */}
    </div>
  )
}
