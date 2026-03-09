"use client"

import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Quote,
  Star,
} from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { testimonials } from "@/data/testimonials"

export default function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleNext = useCallback(() => {
    setIsTransitioning((isCurrentlyTransitioning) => {
      if (isCurrentlyTransitioning) return true // Already transitioning, no change

      // Not transitioning, proceed with the transition
      setCurrentIndex((prevIndex) =>
        prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1,
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
      currentIndex === 0 ? testimonials.length - 1 : currentIndex - 1,
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
    <div className="relative mx-auto max-w-5xl">
      {/* Main Testimonial Display */}
      <div className="relative overflow-hidden rounded-3xl">
        {/* Background with gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-br from-blue-600 via-indigo-700 to-purple-800"></div>
        <div className="absolute inset-0 bg-black/20"></div>

        {/* Animated background elements */}
        <div className="absolute top-0 left-0 h-full w-full overflow-hidden">
          <div className="animate-float absolute -top-20 -left-20 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
          <div
            className="animate-float absolute -right-20 -bottom-20 h-48 w-48 rounded-full bg-white/10 blur-2xl"
            style={{ animationDelay: "2s" }}
          ></div>
          <div className="absolute top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-white/5 blur-xl"></div>
        </div>

        {/* Content Container */}
        <div className="relative z-10 p-12 md:p-16">
          {/* Quote Icon */}
          <div className="mb-8 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 shadow-2xl backdrop-blur-sm">
              <Quote className="h-10 w-10 text-white" />
            </div>
          </div>

          {/* Testimonial Content with Smart Animation */}
          <div
            key={currentIndex}
            className={`transform text-center transition-all duration-600 ease-out ${
              isTransitioning
                ? "translate-y-8 scale-95 opacity-0"
                : "translate-y-0 scale-100 opacity-100"
            } `}
          >
            {/* Stars Rating */}
            <div className="mb-8 flex items-center justify-center space-x-2">
              {[...Array(currentTestimonial.rating)].map((_, i) => (
                <Star
                  key={i}
                  className="animate-fade-in-scale h-6 w-6 fill-current text-yellow-300 drop-shadow-lg"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>

            {/* Testimonial Text */}
            <blockquote className="mb-12">
              <p className="mx-auto max-w-4xl text-xl leading-relaxed font-medium text-white italic md:text-2xl">
                &quot;{currentTestimonial.content}&quot;
              </p>
            </blockquote>

            {/* Author Info */}
            <div className="flex items-center justify-center space-x-6">
              <div className="relative">
                {/* Avatar glow effect */}
                <div className="animate-pulse-glow absolute inset-0 rounded-full bg-linear-to-br from-blue-400 to-indigo-600 opacity-60 blur-lg"></div>
                <Image
                  src={currentTestimonial.avatar}
                  alt={currentTestimonial.name}
                  className="relative h-20 w-20 rounded-full border-4 border-white/30 object-cover shadow-2xl"
                  width={80}
                  height={80}
                />
              </div>
              <div className="text-left">
                <p className="mb-2 text-2xl font-bold text-white">
                  {currentTestimonial.name}
                </p>
                <p className="text-lg font-semibold text-blue-200">
                  {currentTestimonial.role}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="mt-8 flex items-center justify-between">
        {/* Previous Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          disabled={isTransitioning}
          className="h-14 w-14 transform rounded-2xl border-2 border-gray-200 bg-white/90 shadow-xl backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-blue-400 hover:bg-white hover:text-blue-600 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-50"
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
                className={`rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "h-4 w-12 bg-linear-to-r from-blue-500 to-indigo-600 shadow-lg"
                    : "h-4 w-4 bg-gray-300 hover:scale-125 hover:bg-gray-400"
                } disabled:cursor-not-allowed`}
              />
            ))}
          </div>

          {/* Auto-play Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className="rounded-xl border border-gray-200 bg-white/90 px-4 py-2 font-medium backdrop-blur-sm transition-all duration-300 hover:border-blue-400 hover:bg-white"
          >
            {isAutoPlaying ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
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
          className="h-14 w-14 transform rounded-2xl border-2 border-gray-200 bg-white/90 shadow-xl backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-blue-400 hover:bg-white hover:text-blue-600 hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="mx-auto mt-8 w-full max-w-md">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-linear-to-r from-blue-500 to-indigo-600 shadow-lg transition-all duration-500 ease-out"
            style={{
              width: `${((currentIndex + 1) / testimonials.length) * 100}%`,
            }}
          />
        </div>
        <div className="mt-3 flex justify-between text-sm text-gray-600">
          <span className="font-medium">
            {currentIndex + 1} / {testimonials.length}
          </span>
          <span className="text-gray-500">Témoignages</span>
        </div>
      </div>
    </div>
  )
}
