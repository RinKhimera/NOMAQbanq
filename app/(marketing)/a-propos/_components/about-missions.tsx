"use client"

import { Award, Target, Users } from "lucide-react"

const missions = [
  {
    icon: Target,
    title: "Notre mission",
    description:
      "Accompagner les candidats francophones vers la réussite de l'EACMC avec des outils adaptés à leur réalité linguistique et culturelle.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    icon: Users,
    title: "Notre communauté",
    description:
      "Une plateforme créée par des professionnels francophones ayant réussi l'examen pour partager leur expertise et expérience.",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: Award,
    title: "Notre engagement",
    description:
      "Fournir du contenu de qualité, régulièrement mis à jour selon les dernières tendances et exigences de l'EACMC.",
    color: "from-purple-500 to-pink-600",
  },
]

export default function AboutMissions() {
  return (
    <div className="mb-20">
      <div className="animate-fade-in-up mb-16 text-center">
        <div className="mb-8 inline-flex items-center rounded-full border border-purple-200/50 bg-gradient-to-r from-purple-100 to-pink-100 px-6 py-3 text-sm font-semibold text-purple-700 dark:border-purple-700/50 dark:from-purple-900/50 dark:to-pink-900/50 dark:text-purple-300">
          <Target className="mr-2 h-4 w-4" />
          Nos valeurs
        </div>
        <h2 className="font-display text-display-md mb-6 text-gray-900 dark:text-white">
          Ce qui nous anime
        </h2>
        <p className="text-body-lg mx-auto max-w-3xl text-gray-600 dark:text-gray-300">
          Des valeurs fortes qui orientent chacune de nos décisions et actions
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {missions.map((mission, index) => (
          <div
            key={index}
            className="group card-feature animate-fade-in-scale"
            style={{ animationDelay: `${index * 0.2}s` }}
          >
            <div
              className={`mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${mission.color} shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl`}
            >
              <mission.icon className="h-10 w-10 text-white" />
            </div>
            <h3 className="font-display mb-6 text-2xl font-bold text-gray-900 dark:text-white">
              {mission.title}
            </h3>
            <p className="text-lg leading-relaxed text-gray-600 dark:text-gray-300">
              {mission.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
