import Quiz from "@/components/Quiz"
import { BookOpen, Clock, Target, Award } from "lucide-react"

export default function EvaluationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header Section - Ultra modern */}
        <div className="text-center mb-20 animate-fade-in-up">
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold mb-8 border border-blue-200/50 dark:border-blue-700/50">
            <Target className="h-4 w-4 mr-2" />
            Évaluation EACMC Partie I
          </div>
          <h1 className="font-display text-display-lg text-gray-900 dark:text-white mb-8 leading-tight">
            Testez vos connaissances
            <span className="block gradient-text">en conditions réelles</span>
          </h1>
          <p className="text-body-lg text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Évaluez votre niveau avec des questions authentiques adaptées à
            l&apos;examen d&apos;aptitude du Conseil médical du Canada. Obtenez
            un feedback détaillé pour optimiser votre préparation.
          </p>
        </div>

        {/* Instructions Section - Modern cards */}
        <div className="mb-16">
          <div className="text-center mb-12 animate-fade-in-up">
            <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Comment ça fonctionne
            </h2>
            <p className="text-gray-600 dark:text-gray-300 text-lg max-w-2xl mx-auto">
              Suivez ces étapes simples pour commencer votre évaluation
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              {
                icon: Clock,
                title: "Temps limité",
                description:
                  "20 secondes par question pour simuler les conditions réelles de l'examen",
                color: "from-blue-500 to-indigo-600",
              },
              {
                icon: BookOpen,
                title: "Questions variées",
                description:
                  "Sélection aléatoire couvrant tous les domaines médicaux de l'EACMC",
                color: "from-green-500 to-emerald-600",
              },
              {
                icon: Target,
                title: "Résultats détaillés",
                description:
                  "Analyse complète de vos performances avec recommandations personnalisées",
                color: "from-purple-500 to-pink-600",
              },
            ].map((instruction, index) => (
              <div
                key={index}
                className="card-feature animate-fade-in-scale"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div
                  className={`w-16 h-16 bg-gradient-to-br ${instruction.color} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg`}
                >
                  <instruction.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 font-display">
                  {instruction.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {instruction.description}
                </p>
              </div>
            ))}
          </div>

          {/* Stats Preview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {[
              {
                number: "2270",
                label: "Questions disponibles",
                color: "from-blue-500 to-indigo-600",
              },
              {
                number: "85%",
                label: "Taux de réussite moyen",
                color: "from-green-500 to-emerald-600",
              },
              {
                number: "6",
                label: "Domaines médicaux",
                color: "from-purple-500 to-pink-600",
              },
              {
                number: "4000+",
                label: "Candidats préparés",
                color: "from-orange-500 to-red-600",
              },
            ].map((stat, index) => (
              <div
                key={index}
                className="card-modern p-6 text-center hover:shadow-xl transition-all duration-300 animate-fade-in-scale"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div
                  className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg`}
                >
                  <Award className="h-6 w-6 text-white" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1 font-display">
                  {stat.number}
                </p>
                <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Quiz Component */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
          <Quiz />
        </div>
      </div>
    </div>
  )
}
