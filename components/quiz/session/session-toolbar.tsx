"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUp, Calculator, FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SessionToolbarProps } from "./types"

export const SessionToolbar = ({
  showCalculator = true,
  onOpenCalculator,
  showLabValues = true,
  onOpenLabValues,
  showScrollTop = true,
}: SessionToolbarProps) => {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    if (!showScrollTop) return

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 400)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [showScrollTop])

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
    <div className="fixed bottom-6 right-4 z-50 flex flex-col items-end gap-3 touch-none">
      {/* Scroll to top */}
      <AnimatePresence>
        {showScrollTop && isScrolled && (
          <motion.div
            variants={buttonVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            whileHover="hover"
            whileTap="tap"
            transition={springTransition}
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

      {/* Lab Values button */}
      {showLabValues && onOpenLabValues && (
        <motion.div
          variants={buttonVariants}
          initial="initial"
          animate="animate"
          whileHover="hover"
          whileTap="tap"
          transition={{ ...springTransition, delay: 0.05 }}
        >
          <Button
            size="lg"
            onClick={onOpenLabValues}
            className="h-12 w-12 rounded-full bg-linear-to-br from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700 dark:from-teal-400 dark:to-cyan-500 dark:shadow-teal-900/30 dark:hover:from-teal-300 dark:hover:to-cyan-400"
            aria-label="Ouvrir les valeurs de laboratoire"
          >
            <FlaskConical className="h-5 w-5" />
          </Button>
        </motion.div>
      )}

      {/* Calculator button */}
      {showCalculator && onOpenCalculator && (
        <motion.div
          variants={buttonVariants}
          initial="initial"
          animate="animate"
          whileHover="hover"
          whileTap="tap"
          transition={{ ...springTransition, delay: 0.1 }}
        >
          <Button
            size="lg"
            onClick={onOpenCalculator}
            className="h-12 w-12 rounded-full bg-linear-to-br from-purple-600 to-violet-600 shadow-lg shadow-purple-500/25 hover:from-purple-700 hover:to-violet-700 dark:from-purple-500 dark:to-violet-500 dark:shadow-purple-900/30 dark:hover:from-purple-400 dark:hover:to-violet-400"
            aria-label="Ouvrir la calculatrice"
          >
            <Calculator className="h-5 w-5" />
          </Button>
        </motion.div>
      )}
    </div>
  )
}
