"use client"

import { domains } from "@/data/domains"
import DomainCard from "@/components/DomainCard"
import { BookOpen, Target, Clock, BarChart3 } from "lucide-react"
// import { useLanguage } from "@/contexts/LanguageContext"

export default function DomainesPage() {
  // const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-20 animate-fade-in-up">
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold mb-8 border border-blue-200/50 dark:border-blue-700/50">
            <BookOpen className="h-4 w-4 mr-2" />
            Domaines d&apos;expertise
          </div>
          <h1 className="font-display text-display-lg text-gray-900 dark:text-white mb-8">
            Domaines d&apos;évaluation
          </h1>
          <p className="text-body-lg text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Explorez nos domaines médicaux spécialisés et testez vos
            connaissances avec des questions adaptées à l&apos;EACMC Partie I
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-20">
          {[
            {
              icon: BookOpen,
              number: "6",
              label: "Domaines disponibles",
              color: "from-blue-500 to-indigo-600",
            },
            {
              icon: Target,
              number: "2270",
              label: "Questions au total",
              color: "from-green-500 to-emerald-600",
            },
            {
              icon: Clock,
              number: "20s",
              label: "Par question",
              color: "from-purple-500 to-pink-600",
            },
            {
              icon: BarChart3,
              number: "85%",
              label: "Taux de réussite",
              color: "from-orange-500 to-red-600",
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="card-modern p-8 text-center hover:shadow-xl transition-all duration-300 animate-fade-in-scale"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div
                className={`w-16 h-16 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg`}
              >
                <stat.icon className="h-8 w-8 text-white" />
              </div>
              <p className="text-4xl font-bold text-gray-900 dark:text-white mb-2 font-display">
                {stat.number}
              </p>
              <p className="text-gray-600 dark:text-gray-300 font-medium">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Domains Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
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
          <div className="card-modern p-12 text-center shadow-xl">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-6">
                Prêt à commencer votre évaluation ?
              </h2>
              <p className="text-body-lg text-gray-600 dark:text-gray-300 mb-10 leading-relaxed">
                Choisissez un domaine ci-dessus ou commencez par une évaluation
                générale pour tester vos connaissances globales
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-4 rounded-2xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl btn-modern">
                  Évaluation générale
                </button>
                <button className="border-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-10 py-4 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg">
                  Voir mon progrès
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
