"use client"

import { IconPhoto, IconZoomIn } from "@tabler/icons-react"
import Image from "next/image"
import { useState } from "react"
import Lightbox from "yet-another-react-lightbox"
import Zoom from "yet-another-react-lightbox/plugins/zoom"
import Counter from "yet-another-react-lightbox/plugins/counter"
import "yet-another-react-lightbox/styles.css"
import "yet-another-react-lightbox/plugins/counter.css"
import { cn } from "@/lib/utils"

// ============================================
// TYPES
// ============================================

export type QuestionImage = {
  url: string
  storagePath: string
  order: number
}

type QuestionImageGalleryProps = {
  images: QuestionImage[]
  maxDisplay?: number
  size?: "sm" | "md" | "lg"
  className?: string
}

// ============================================
// HELPER: Build optimized URL
// ============================================

const getOptimizedUrl = (url: string, width: number = 800): string => {
  // Si c'est une URL Bunny CDN, ajouter les paramètres d'optimisation
  if (url.includes("b-cdn.net")) {
    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}width=${width}&quality=85`
  }
  return url
}

const getThumbnailUrl = (url: string, size: number = 200): string => {
  if (url.includes("b-cdn.net")) {
    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}width=${size}&height=${size}&crop=fit&quality=80`
  }
  return url
}

// ============================================
// MAIN COMPONENT
// ============================================

export const QuestionImageGallery = ({
  images,
  maxDisplay = 4,
  size = "md",
  className,
}: QuestionImageGalleryProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const allImages = [...images].sort((a, b) => a.order - b.order)

  if (allImages.length === 0) {
    return null
  }

  const sizeClasses = {
    sm: "h-20 w-20",
    md: "h-32 w-32",
    lg: "h-48 w-48",
  }

  const displayedImages = allImages.slice(0, maxDisplay)
  const remainingCount = allImages.length - maxDisplay

  const lightboxSlides = allImages.map((img) => ({
    src: getOptimizedUrl(img.url, 1200),
    alt: `Image ${img.order + 1}`,
  }))

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  // Single image display
  if (allImages.length === 1) {
    return (
      <>
        <button
          type="button"
          onClick={() => openLightbox(0)}
          className={cn(
            "group relative cursor-pointer overflow-hidden rounded-lg border bg-muted transition-all hover:ring-2 hover:ring-blue-500",
            sizeClasses[size],
            className,
          )}
        >
          <Image
            src={getThumbnailUrl(allImages[0].url)}
            alt="Image de la question"
            fill
            className="object-cover"
            sizes={`(max-width: 768px) 100vw, ${size === "lg" ? "192px" : size === "md" ? "128px" : "80px"}`}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <IconZoomIn className="h-6 w-6 text-white" />
          </div>
        </button>

        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          index={lightboxIndex}
          slides={lightboxSlides}
          plugins={[Zoom]}
          zoom={{
            maxZoomPixelRatio: 3,
            zoomInMultiplier: 2,
          }}
        />
      </>
    )
  }

  // Multiple images grid
  return (
    <>
      <div className={cn("flex flex-wrap gap-2", className)}>
        {displayedImages.map((image, index) => (
          <button
            key={image.storagePath || index}
            type="button"
            onClick={() => openLightbox(index)}
            className={cn(
              "group relative cursor-pointer overflow-hidden rounded-lg border bg-muted transition-all hover:ring-2 hover:ring-blue-500",
              size === "sm" ? "h-16 w-16" : size === "md" ? "h-24 w-24" : "h-32 w-32",
            )}
          >
            <Image
              src={getThumbnailUrl(image.url)}
              alt={`Image ${index + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 64px, 96px"
            />

            {/* Show remaining count on last visible image */}
            {index === maxDisplay - 1 && remainingCount > 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="text-lg font-bold text-white">
                  +{remainingCount}
                </span>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <IconZoomIn className="h-5 w-5 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={lightboxSlides}
        plugins={[Zoom, Counter]}
        zoom={{
          maxZoomPixelRatio: 3,
          zoomInMultiplier: 2,
        }}
        counter={{ container: { style: { top: "unset", bottom: 0 } } }}
      />
    </>
  )
}

// ============================================
// COMPACT VARIANT (for lists)
// ============================================

export const QuestionImageIndicator = ({
  images,
}: {
  images?: QuestionImage[]
}) => {
  const count = images?.length || 0

  if (count === 0) return null

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
      <IconPhoto className="h-3 w-3" />
      {count}
    </span>
  )
}
