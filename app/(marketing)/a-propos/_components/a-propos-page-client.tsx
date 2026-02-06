"use client"

import { Award, CheckCircle } from "lucide-react"
import Image from "next/image"
import AboutCTA from "./about-cta"
import AboutHeader from "./about-header"
import AboutMissions from "./about-missions"
import AboutStats from "./about-stats"
import AboutStory from "./about-story"
import AboutTestimonials from "./about-testimonials"

export default function AProposPageClient() {
  return (
    <div className="theme-bg">
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        <AboutHeader />
        <AboutStats />
        <div className="mb-20 grid items-center gap-20 lg:grid-cols-2">
          <AboutStory />
          <div
            className="animate-slide-in-right relative"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="glass-card relative z-10 rounded-3xl p-2 shadow-2xl">
              <Image
                src="https://images.pexels.com/photos/5327921/pexels-photo-5327921.jpeg?auto=compress&cs=tinysrgb&w=600"
                alt="Équipe médicale francophone"
                width={600}
                height={400}
                className="h-100 w-full rounded-2xl object-cover"
              />
            </div>
            <div className="glass-card animate-float absolute -top-6 -right-6 z-20 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-green-400 to-emerald-600">
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
              className="glass-card animate-float absolute -bottom-6 -left-6 z-20 rounded-2xl p-4 shadow-lg"
              style={{ animationDelay: "1s" }}
            >
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-400 to-indigo-600">
                  <Award className="h-6 w-6 text-white" />
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
          </div>
        </div>
        <AboutMissions />
        <div className="relative mb-20 overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-br from-blue-600 via-indigo-700 to-purple-800"></div>
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute top-0 left-0 h-full w-full overflow-hidden">
            <div className="animate-float absolute -top-40 -left-40 h-80 w-80 rounded-full bg-white/10 blur-3xl"></div>
            <div
              className="animate-float absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-white/10 blur-3xl"
              style={{ animationDelay: "2s" }}
            ></div>
          </div>
          <div className="relative z-10 p-16 text-center">
            <h2 className="font-display text-display-md mb-12 text-white">
              Ce qui nous guide
            </h2>
            <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 md:grid-cols-4">
              {[
                "Excellence académique",
                "Accompagnement personnalisé",
                "Innovation pédagogique",
                "Communauté francophone",
              ].map((value) => (
                <div
                  key={value}
                  className="glass-card-dark rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:bg-white/20"
                >
                  <p className="text-lg font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <AboutTestimonials />
        <AboutCTA />
      </div>
    </div>
  )
}
