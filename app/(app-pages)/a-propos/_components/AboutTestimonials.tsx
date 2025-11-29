"use client"

import { Star } from "lucide-react"
import TestimonialsCarousel from "@/components/testimonials-carousel"

export default function AboutTestimonials() {
  return (
    <div className="mb-20">
      <div className="animate-fade-in-up mb-16 text-center">
        <div className="mb-8 inline-flex items-center rounded-full border border-yellow-200/50 bg-gradient-to-r from-yellow-100 to-orange-100 px-6 py-3 text-sm font-semibold text-yellow-700 dark:border-yellow-700/50 dark:from-yellow-900/50 dark:to-orange-900/50 dark:text-yellow-300">
          <Star className="mr-2 h-4 w-4" />
          Témoignages
        </div>
        <h2 className="font-display text-display-md mb-6 text-gray-900 dark:text-white">
          Ils ont réussi avec NOMAQbanq
        </h2>
        <p className="text-body-lg mx-auto max-w-3xl text-gray-600 dark:text-gray-300">
          Des témoignages authentiques de professionnels qui ont réussi grâce à
          NOMAQbanq
        </p>
      </div>
      <div className="animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
        <TestimonialsCarousel />
      </div>
    </div>
  )
}
