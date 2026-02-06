"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ScrollToTopProps {
  /** Scroll distance (px) before button appears */
  threshold?: number
  /** Position on screen */
  position?: "left" | "right"
  /** Additional class names to override position (e.g., "bottom-24 right-6") */
  className?: string
  /** Z-index layer */
  zIndex?: number
}

export const ScrollToTop = ({
  threshold = 500,
  position = "right",
  className,
  zIndex = 40,
}: ScrollToTopProps) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > threshold)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [threshold])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const buttonVariants = {
    initial: { opacity: 0, scale: 0.8, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.8, y: 20 },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 },
  }

  const springTransition = {
    type: "spring" as const,
    stiffness: 300,
    damping: 25,
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={buttonVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          whileHover="hover"
          whileTap="tap"
          transition={springTransition}
          className={cn(
            "fixed bottom-6",
            position === "right" ? "right-6" : "left-6",
            className
          )}
          style={{ zIndex }}
        >
          <Button
            size="lg"
            onClick={scrollToTop}
            className="h-12 w-12 rounded-full bg-linear-to-br from-gray-600 to-gray-800 shadow-lg shadow-gray-500/20 hover:from-gray-700 hover:to-gray-900 dark:from-gray-500 dark:to-gray-700 dark:shadow-gray-900/30 dark:hover:from-gray-400 dark:hover:to-gray-600"
            aria-label="Retourner en haut de page"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
