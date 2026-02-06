"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Quote,
  Play,
  Pause,
} from "lucide-react"
import { testimonials } from "@/data/testimonials"
import { Button } from "@/components/ui/button"
import Image from "next/image"

export default function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleNext = useCallback(() => {
    setIsTransitioning((isCurrentlyTransitioning) => {
      if (isCurrentlyTransitioning) return true // Already transitioning, no change

      // Not transitioning, proceed with the transition
      setCurrentIndex((prevIndex) =>
        prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
      )
      setTimeout(() => setIsTransitioning(false), 600)
      return true
    })
  }, []) // Stable callback - zero dependencies

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      handleNext()
    }, 5000)

    return () => clearInterval(interval)
  }, [isAutoPlaying, handleNext])

  const handlePrevious = () => {
    if (isTransitioning) return
    setIsAutoPlaying(false)
    setIsTransitioning(true)
    setCurrentIndex(
      currentIndex === 0 ? testimonials.length - 1 : currentIndex - 1
    )
    setTimeout(() => setIsTransitioning(false), 600)
  }

  const goToSlide = (index: number) => {
    if (isTransitioning || index === currentIndex) return
    setIsAutoPlaying(false)
    setIsTransitioning(true)
    setCurrentIndex(index)
    setTimeout(() => setIsTransitioning(false), 600)
  }

  const currentTestimonial = testimonials[currentIndex]

  return (
    <div className="relative max-w-5xl mx-auto">
      {/* Main Testimonial Display */}
      <div className="relative overflow-hidden rounded-3xl">
        {/* Background with gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-br from-blue-600 via-indigo-700 to-purple-800"></div>
        <div className="absolute inset-0 bg-black/20"></div>

        {/* Animated background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-white/10 rounded-full blur-2xl animate-float"></div>
          <div
            className="absolute -bottom-20 -right-20 w-48 h-48 bg-white/10 rounded-full blur-2xl animate-float"
            style={{ animationDelay: "2s" }}
          ></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/5 rounded-full blur-xl"></div>
        </div>

        {/* Content Container */}
        <div className="relative z-10 p-12 md:p-16">
          {/* Quote Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-2xl">
              <Quote className="h-10 w-10 text-white" />
            </div>
          </div>

          {/* Testimonial Content with Smart Animation */}
          <div
            key={currentIndex}
            className={`
              text-center transition-all duration-600 ease-out transform
              ${
                isTransitioning
                  ? "opacity-0 translate-y-8 scale-95"
                  : "opacity-100 translate-y-0 scale-100"
              }
            `}
          >
            {/* Stars Rating */}
            <div className="flex justify-center items-center space-x-2 mb-8">
              {[...Array(currentTestimonial.rating)].map((_, i) => (
                <Star
                  key={i}
                  className="h-6 w-6 text-yellow-300 fill-current drop-shadow-lg animate-fade-in-scale"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>

            {/* Testimonial Text */}
            <blockquote className="mb-12">
              <p className="text-xl md:text-2xl text-white leading-relaxed italic font-medium max-w-4xl mx-auto">
                &quot;{currentTestimonial.content}&quot;
              </p>
            </blockquote>

            {/* Author Info */}
            <div className="flex items-center justify-center space-x-6">
              <div className="relative">
                {/* Avatar glow effect */}
                <div className="absolute inset-0 bg-linear-to-br from-blue-400 to-indigo-600 rounded-full blur-lg opacity-60 animate-pulse-glow"></div>
                <Image
                  src={currentTestimonial.avatar}
                  alt={currentTestimonial.name}
                  className="relative w-20 h-20 rounded-full object-cover border-4 border-white/30 shadow-2xl"
                  width={80}
                  height={80}
                />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-white mb-2">
                  {currentTestimonial.name}
                </p>
                <p className="text-blue-200 font-semibold text-lg">
                  {currentTestimonial.role}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-between items-center mt-8">
        {/* Previous Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          disabled={isTransitioning}
          className="w-14 h-14 rounded-2xl bg-white/90 backdrop-blur-sm border-2 border-gray-200 hover:bg-white hover:border-blue-400 hover:text-blue-600 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        {/* Center Controls */}
        <div className="flex items-center space-x-8">
          {/* Dots Indicators */}
          <div className="flex space-x-3">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                disabled={isTransitioning}
                className={`
                  transition-all duration-300 rounded-full
                  ${
                    index === currentIndex
                      ? "w-12 h-4 bg-linear-to-r from-blue-500 to-indigo-600 shadow-lg"
                      : "w-4 h-4 bg-gray-300 hover:bg-gray-400 hover:scale-125"
                  }
                  disabled:cursor-not-allowed
                `}
              />
            ))}
          </div>

          {/* Auto-play Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className="bg-white/90 backdrop-blur-sm border border-gray-200 hover:bg-white hover:border-blue-400 px-4 py-2 rounded-xl font-medium transition-all duration-300"
          >
            {isAutoPlaying ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Play
              </>
            )}
          </Button>
        </div>

        {/* Next Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          disabled={isTransitioning}
          className="w-14 h-14 rounded-2xl bg-white/90 backdrop-blur-sm border-2 border-gray-200 hover:bg-white hover:border-blue-400 hover:text-blue-600 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="mt-8 w-full max-w-md mx-auto">
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-linear-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500 ease-out shadow-lg"
            style={{
              width: `${((currentIndex + 1) / testimonials.length) * 100}%`,
            }}
          />
        </div>
        <div className="flex justify-between mt-3 text-sm text-gray-600">
          <span className="font-medium">
            {currentIndex + 1} / {testimonials.length}
          </span>
          <span className="text-gray-500">Témoignages</span>
        </div>
      </div>
    </div>
  )
}
