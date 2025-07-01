'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';
import { testimonials } from '@/data/testimonials';
import { Button } from '@/components/ui/button';

export default function TestimonialsCarousel3D() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
      );
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToPrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex(currentIndex === 0 ? testimonials.length - 1 : currentIndex - 1);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex(currentIndex === testimonials.length - 1 ? 0 : currentIndex + 1);
  };

  const goToSlide = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
  };

  const getSlidePosition = (index: number) => {
    const diff = index - currentIndex;
    if (diff === 0) return 'center';
    if (diff === 1 || (diff === -(testimonials.length - 1))) return 'right';
    if (diff === -1 || (diff === testimonials.length - 1)) return 'left';
    return 'hidden';
  };

  const getSlideStyles = (position: string) => {
    const baseStyles = 'absolute top-0 w-full transition-all duration-700 ease-in-out transform-gpu';
    
    switch (position) {
      case 'center':
        return `${baseStyles} translate-x-0 scale-100 z-30 opacity-100`;
      case 'right':
        return `${baseStyles} translate-x-[60%] scale-75 z-20 opacity-60`;
      case 'left':
        return `${baseStyles} -translate-x-[60%] scale-75 z-20 opacity-60`;
      case 'hidden':
        return `${baseStyles} translate-x-full scale-50 z-10 opacity-0`;
      default:
        return `${baseStyles} translate-x-full scale-50 z-10 opacity-0`;
    }
  };

  return (
    <div className="relative max-w-6xl mx-auto px-4">
      {/* 3D Carousel Container */}
      <div className="relative h-[500px] perspective-1000">
        <div className="relative w-full h-full preserve-3d">
          {testimonials.map((testimonial, index) => {
            const position = getSlidePosition(index);
            const isCenter = position === 'center';
            
            return (
              <div
                key={testimonial.id}
                className={getSlideStyles(position)}
                style={{
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Testimonial Card with 3D effect */}
                <div className={`
                  relative mx-auto max-w-2xl h-full
                  ${isCenter ? 'cursor-default' : 'cursor-pointer hover:scale-105'}
                  transition-all duration-500
                `}
                onClick={() => !isCenter && goToSlide(index)}
                >
                  {/* Card Shadow/Depth */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-indigo-800/20 rounded-3xl blur-xl transform translate-y-8 translate-x-4 scale-95"></div>
                  
                  {/* Main Card */}
                  <div className={`
                    relative h-full bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 
                    backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl
                    ${isCenter ? 'shadow-blue-500/25' : 'shadow-gray-500/20'}
                    transition-all duration-700
                  `}>
                    {/* Decorative elements */}
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-2xl"></div>
                    <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-2xl"></div>
                    
                    <div className="relative z-10 p-12 h-full flex flex-col justify-between">
                      {/* Quote Icon */}
                      <div className="absolute top-8 left-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <Quote className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      
                      {/* Stars Rating */}
                      <div className="flex justify-center items-center space-x-1 mb-8 mt-16">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} className="h-6 w-6 text-yellow-400 fill-current drop-shadow-sm" />
                        ))}
                      </div>
                      
                      {/* Testimonial Content */}
                      <div className="flex-1 flex items-center">
                        <blockquote className="text-center">
                          <p className={`
                            text-gray-700 leading-relaxed italic font-medium
                            ${isCenter ? 'text-xl' : 'text-lg'}
                            transition-all duration-700
                          `}>
                            "{testimonial.content}"
                          </p>
                        </blockquote>
                      </div>
                      
                      {/* Author Info */}
                      <div className="flex items-center justify-center space-x-6 mt-8">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full blur-md opacity-50"></div>
                          <img
                            src={testimonial.avatar}
                            alt={testimonial.name}
                            className="relative w-20 h-20 rounded-full object-cover border-4 border-white shadow-xl"
                          />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-gray-900 text-xl mb-1">{testimonial.name}</p>
                          <p className="text-blue-600 font-semibold">{testimonial.role}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-center items-center space-x-8 mt-12">
        {/* Previous Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={goToPrevious}
          className="w-16 h-16 rounded-2xl bg-white/80 backdrop-blur-sm border-2 border-blue-200 hover:bg-white hover:border-blue-400 hover:text-blue-600 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110 group"
        >
          <ChevronLeft className="h-6 w-6 group-hover:scale-125 transition-transform duration-300" />
        </Button>

        {/* Dots Indicators */}
        <div className="flex space-x-3">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`
                transition-all duration-300 rounded-full
                ${index === currentIndex
                  ? 'w-12 h-4 bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg'
                  : 'w-4 h-4 bg-gray-300 hover:bg-gray-400 hover:scale-125'
                }
              `}
            />
          ))}
        </div>

        {/* Next Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={goToNext}
          className="w-16 h-16 rounded-2xl bg-white/80 backdrop-blur-sm border-2 border-blue-200 hover:bg-white hover:border-blue-400 hover:text-blue-600 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110 group"
        >
          <ChevronRight className="h-6 w-6 group-hover:scale-125 transition-transform duration-300" />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="mt-8 w-full max-w-md mx-auto">
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-700 ease-out shadow-lg"
            style={{ width: `${((currentIndex + 1) / testimonials.length) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-500">
          <span>{currentIndex + 1}</span>
          <span>{testimonials.length}</span>
        </div>
      </div>

      {/* Auto-play indicator */}
      <div className="flex justify-center mt-6">
        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className={`
            px-6 py-2 rounded-full text-sm font-medium transition-all duration-300
            ${isAutoPlaying 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : 'bg-gray-100 text-gray-600 border border-gray-200'
            }
            hover:shadow-lg transform hover:scale-105
          `}
        >
          {isAutoPlaying ? '⏸️ Pause' : '▶️ Play'} Auto-défilement
        </button>
      </div>
    </div>
  );
}