"use client"

import { domains } from "@/data/domains"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Heart,
  Sun as Lung,
  Brain,
  Activity,
  Baby,
  Users,
  ArrowLeft,
  Play,
  BookOpen,
  Clock,
  Target,
  Star,
  CheckCircle,
  Lock,
  TrendingUp,
  BarChart3,
  Lightbulb,
  FileText,
  Shield,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const iconMap = {
  Heart,
  Lung,
  Brain,
  Activity,
  Baby,
  Users,
}

interface DomainPageProps {
  params: {
    slug: string
  }
}

export default function DomainPage({ params }: DomainPageProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false) // Simulated auth state
  const domain = domains.find((d) => d.slug === params.slug)

  if (!domain) {
    notFound()
  }

  const IconComponent = iconMap[domain.icon as keyof typeof iconMap]

  // Domain-specific data (this would come from a database in a real app)
  const domainData = {
    cardiologie: {
      objectives: [
        "Diagnostiquer les principales pathologies cardiovasculaires",
        "Interpréter les ECG et examens cardiaques",
        "Maîtriser la prise en charge de l'insuffisance cardiaque",
        "Reconnaître et traiter les arythmies courantes",
        "Comprendre la pharmacologie cardiovasculaire",
      ],
      topics: [
        {
          name: "Insuffisance cardiaque",
          questions: 85,
          difficulty: "Intermédiaire",
        },
        { name: "Arythmies", questions: 92, difficulty: "Avancé" },
        {
          name: "Cardiopathies ischémiques",
          questions: 78,
          difficulty: "Intermédiaire",
        },
        { name: "Valvulopathies", questions: 65, difficulty: "Avancé" },
        {
          name: "Hypertension artérielle",
          questions: 70,
          difficulty: "Débutant",
        },
        {
          name: "ECG et troubles du rythme",
          questions: 60,
          difficulty: "Intermédiaire",
        },
      ],
      stats: {
        averageScore: 72,
        completionRate: 89,
        timePerQuestion: 18,
        difficulty: "Intermédiaire",
      },
      tips: [
        "Maîtrisez l'interprétation des ECG avant tout",
        "Apprenez les classifications des insuffisances cardiaques",
        "Mémorisez les doses des médicaments cardiovasculaires",
        "Pratiquez les calculs de fraction d'éjection",
      ],
    },
    // Add similar data for other domains...
    pneumologie: {
      objectives: [
        "Diagnostiquer les pathologies respiratoires courantes",
        "Interpréter les radiographies thoraciques",
        "Maîtriser la spirométrie et les EFR",
        "Comprendre la physiopathologie respiratoire",
        "Gérer l'asthme et la BPCO",
      ],
      topics: [
        { name: "Asthme", questions: 65, difficulty: "Débutant" },
        { name: "BPCO", questions: 72, difficulty: "Intermédiaire" },
        { name: "Pneumonies", questions: 58, difficulty: "Intermédiaire" },
        { name: "Embolie pulmonaire", questions: 45, difficulty: "Avancé" },
        {
          name: "Radiologie thoracique",
          questions: 80,
          difficulty: "Intermédiaire",
        },
        {
          name: "Insuffisance respiratoire",
          questions: 60,
          difficulty: "Avancé",
        },
      ],
      stats: {
        averageScore: 68,
        completionRate: 85,
        timePerQuestion: 19,
        difficulty: "Intermédiaire",
      },
      tips: [
        "Apprenez à lire systématiquement les radiographies",
        "Maîtrisez les critères diagnostiques de l'asthme",
        "Comprenez les stades de la BPCO",
        "Mémorisez les scores de Wells pour l'EP",
      ],
    },
  }

  const currentDomainData =
    domainData[domain.slug as keyof typeof domainData] || domainData.cardiologie

  const handleStartTest = () => {
    if (!isLoggedIn) {
      // Show login modal or redirect to login
      return
    }
    // Redirect to test
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Back button */}
        <div className="mb-8 animate-fade-in-up">
          <Link
            href="/domaines"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200 group"
          >
            <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
            Retour aux domaines
          </Link>
        </div>

        {/* Header Section */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          <div className="animate-slide-in-left">
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold mb-8 border border-blue-200/50 dark:border-blue-700/50">
              <IconComponent className="h-4 w-4 mr-2" />
              Domaine médical
            </div>

            <h1 className="font-display text-display-lg text-gray-900 dark:text-white mb-6 leading-tight">
              {domain.title}
            </h1>

            <p className="text-body-lg text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              {domain.description}
            </p>

            <div className="flex items-center space-x-6 mb-8">
              <div className="flex items-center space-x-2">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-lg">
                    {domain.questionsCount}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Questions disponibles
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-lg">
                    {currentDomainData.stats.averageScore}%
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Score moyen
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {isLoggedIn ? (
                <Link href="/evaluation">
                  <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 text-lg h-auto rounded-2xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 btn-modern">
                    <Play className="h-5 w-5 mr-2" />
                    Commencer l&apos;évaluation
                  </Button>
                </Link>
              ) : (
                <div className="relative group">
                  <Button
                    disabled
                    className="bg-gray-400 text-white px-8 py-4 text-lg h-auto rounded-2xl font-semibold cursor-not-allowed opacity-75"
                  >
                    <Lock className="h-5 w-5 mr-2" />
                    Évaluation verrouillée
                  </Button>
                  <div className="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                    <div className="bg-gray-900 text-white text-sm rounded-lg px-3 py-2 whitespace-nowrap">
                      Connectez-vous pour accéder aux tests
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="border-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-8 py-4 text-lg h-auto rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg"
              >
                <BarChart3 className="h-5 w-5 mr-2" />
                Voir les statistiques
              </Button>
            </div>
          </div>

          <div
            className="animate-slide-in-right"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="relative">
              <div className="glass-card rounded-3xl p-2 shadow-2xl">
                <img
                  src="https://images.pexels.com/photos/4386466/pexels-photo-4386466.jpeg?auto=compress&cs=tinysrgb&w=600"
                  alt={`Domaine ${domain.title}`}
                  className="w-full h-[400px] object-cover rounded-2xl"
                />
              </div>

              {/* Floating stats */}
              <div className="absolute -top-6 -right-6 glass-card rounded-2xl p-4 shadow-lg animate-float z-20">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {currentDomainData.stats.completionRate}%
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Taux de completion
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="absolute -bottom-6 -left-6 glass-card rounded-2xl p-4 shadow-lg animate-float z-20"
                style={{ animationDelay: "1s" }}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-600 rounded-xl flex items-center justify-center">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {currentDomainData.stats.timePerQuestion}s
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Temps moyen
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Objectives Section */}
        <div className="mb-16">
          <div className="text-center mb-12 animate-fade-in-up">
            <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Objectifs d&apos;apprentissage
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-lg max-w-3xl mx-auto">
              Compétences clés que vous développerez dans ce domaine
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentDomainData.objectives.map((objective, index) => (
              <div
                key={index}
                className="card-modern p-6 hover:shadow-xl transition-all duration-300 animate-fade-in-scale"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                    {objective}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Topics Breakdown */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          <div className="animate-slide-in-left">
            <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-8">
              Sujets couverts
            </h2>
            <div className="space-y-4">
              {currentDomainData.topics.map((topic, index) => (
                <div
                  key={index}
                  className="card-modern p-6 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {topic.name}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        topic.difficulty === "Débutant"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : topic.difficulty === "Intermédiaire"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      }`}
                    >
                      {topic.difficulty}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {topic.questions} questions
                    </span>
                    <div className="flex items-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i <
                            (topic.difficulty === "Avancé"
                              ? 5
                              : topic.difficulty === "Intermédiaire"
                              ? 3
                              : 2)
                              ? "text-yellow-400 fill-current"
                              : "text-gray-300 dark:text-gray-600"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="animate-slide-in-right"
            style={{ animationDelay: "0.2s" }}
          >
            <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-8">
              Conseils d&apos;étude
            </h2>
            <div className="space-y-6">
              {currentDomainData.tips.map((tip, index) => (
                <div
                  key={index}
                  className="card-modern p-6 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Lightbulb className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                      {tip}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Performance Stats */}
            <div className="card-modern p-8 mt-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 font-display">
                Statistiques de performance
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                    {currentDomainData.stats.averageScore}%
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Score moyen
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                    {currentDomainData.stats.completionRate}%
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Taux de completion
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                    {currentDomainData.stats.timePerQuestion}s
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Temps moyen
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                    {currentDomainData.stats.difficulty}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Niveau
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Authentication CTA */}
        {!isLoggedIn && (
          <div className="relative mb-16 overflow-hidden animate-fade-in-up">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800"></div>
            <div className="absolute inset-0 bg-black/20"></div>

            <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
              <div className="absolute -top-20 -left-20 w-40 h-40 bg-white/10 rounded-full blur-2xl animate-float"></div>
              <div
                className="absolute -bottom-20 -right-20 w-48 h-48 bg-white/10 rounded-full blur-2xl animate-float"
                style={{ animationDelay: "2s" }}
              ></div>
            </div>

            <div className="relative z-10 p-12 text-center">
              <div className="inline-flex items-center px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-semibold mb-8 border border-white/30">
                <Shield className="h-4 w-4 mr-2" />
                Accès premium requis
              </div>
              <h2 className="font-display text-4xl font-bold text-white mb-6">
                Débloquez l&apos;accès complet à {domain.title}
              </h2>
              <p className="text-xl text-blue-100 mb-10 max-w-3xl mx-auto leading-relaxed">
                Créez un compte gratuit pour accéder aux {domain.questionsCount}{" "}
                questions, aux explications détaillées et au suivi de vos
                progrès dans ce domaine.
              </p>

              <div className="grid md:grid-cols-3 gap-6 mb-10 max-w-3xl mx-auto">
                {[
                  {
                    icon: BookOpen,
                    text: `${domain.questionsCount} Questions`,
                  },
                  { icon: FileText, text: "Explications détaillées" },
                  { icon: BarChart3, text: "Suivi des progrès" },
                ].map((feature, index) => (
                  <div
                    key={index}
                    className="glass-card-dark rounded-xl p-4 hover:bg-white/20 transition-all duration-300"
                  >
                    <feature.icon className="h-6 w-6 text-white mx-auto mb-2" />
                    <p className="text-white text-sm font-medium">
                      {feature.text}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <Link href="/inscription">
                  <Button className="bg-white text-blue-600 hover:bg-blue-50 px-12 py-4 text-lg h-auto font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 btn-modern">
                    Créer un compte gratuit
                  </Button>
                </Link>
                <Link href="/connexion">
                  <Button
                    variant="outline"
                    className="border-2 border-white/30 text-white hover:bg-white/10 px-12 py-4 text-lg h-auto rounded-2xl font-semibold transition-all duration-300 glass-card-dark"
                  >
                    Se connecter
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="text-center animate-fade-in-up">
          <div className="card-modern p-12 shadow-xl">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-6">
                Prêt à maîtriser {domain.title} ?
              </h2>
              <p className="text-body-lg text-gray-600 dark:text-gray-300 mb-10 leading-relaxed">
                Commencez votre apprentissage dès maintenant avec nos questions
                adaptées aux standards de l&apos;EACMC et progressez à votre
                rythme.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                {isLoggedIn ? (
                  <Link href="/evaluation">
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-4 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl btn-modern">
                      Commencer l&apos;évaluation
                    </Button>
                  </Link>
                ) : (
                  <Link href="/inscription">
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-4 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl btn-modern">
                      S&apos;inscrire gratuitement
                    </Button>
                  </Link>
                )}
                <Link href="/domaines">
                  <Button
                    variant="outline"
                    className="border-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-10 py-4 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg"
                  >
                    Explorer d&apos;autres domaines
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
