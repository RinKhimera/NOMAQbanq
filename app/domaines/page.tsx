"use client"

import { domains } from "@/data/domains"
import DomainCard from "@/components/DomainCard"
import { BookOpen, Target, Clock, BarChart3, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const stats = [
  {
    Icon: BookOpen,
    number: "6",
    label: "Domaines disponibles",
    color: "from-blue-500 to-indigo-600",
    gradient: "from-blue-500/20 to-indigo-600/20",
  },
  {
    Icon: Target,
    number: "2270",
    label: "Questions au total",
    color: "from-green-500 to-emerald-600",
    gradient: "from-green-500/20 to-emerald-600/20",
  },
  {
    Icon: Clock,
    number: "20s",
    label: "Par question",
    color: "from-purple-500 to-pink-600",
    gradient: "from-purple-500/20 to-pink-600/20",
  },
  {
    Icon: BarChart3,
    number: "85%",
    label: "Taux de réussite",
    color: "from-orange-500 to-red-600",
    gradient: "from-orange-500/20 to-red-600/20",
  },
]

export default function DomainesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20 lg:pt-24 pb-16 lg:pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16 sm:mb-20 space-y-6 sm:space-y-8 animate-fade-in-up">
          <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-200/50 dark:border-blue-700/30 shadow-sm hover:shadow-md transition-all duration-300">
            <BookOpen className="h-4 w-4 mr-2" />
            Domaines d&apos;expertise
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-gray-900 dark:text-white leading-tight tracking-tight">
              Domaines d&apos;
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                évaluation
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
              Explorez nos domaines médicaux spécialisés et testez vos
              connaissances avec des questions adaptées à l&apos;EACMC Partie I
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-16 sm:mb-20">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="group bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-gray-200/50 dark:border-gray-700/30 hover:bg-gradient-to-br hover:border-transparent dark:hover:border-transparent transition-all duration-500 hover:scale-105 hover:shadow-xl animate-fade-in-scale"
              style={{
                animationDelay: `${index * 0.1}s`,
                background: `linear-gradient(135deg, ${stat.gradient})`,
              }}
            >
              <div
                className={`w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110`}
              >
                <stat.Icon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <p className={`text-3xl sm:text-4xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-2 font-display text-center`}>
                {stat.number}
              </p>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-medium text-center">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Domains Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-16 sm:mb-20">
          {domains.map((domain, index) => (
            <div
              key={domain.id}
              className="animate-fade-in-scale"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <DomainCard domain={domain} />
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="animate-fade-in-up">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-3xl p-8 sm:p-12 border border-gray-200/50 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                Prêt à commencer votre{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                  évaluation
                </span>
                ?
              </h2>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
                Choisissez un domaine ci-dessus ou commencez par une évaluation
                générale pour tester vos connaissances globales
              </p>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center pt-4">
                <Link href="/evaluation">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    Évaluation générale
                    <ArrowRight className="ml-2 h-5 w-5 animate-bounce-x" />
                  </Button>
                </Link>
                <Link href="/dashboard/results">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto border-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-8 py-6 text-lg font-semibold rounded-xl transition-all duration-300 hover:shadow-lg"
                  >
                    Voir mon progrès
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
