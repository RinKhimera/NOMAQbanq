"use client"

import { useEffect, useRef, useState } from "react"

interface HeaderScrollState {
  isVisible: boolean
  isScrolled: boolean
}

export const useHeaderScroll = (): HeaderScrollState => {
  const [isVisible, setIsVisible] = useState(true)
  const [isScrolled, setIsScrolled] = useState(false)
  const lastScrollY = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    const handleScroll = () => {
      if (ticking.current) return

      ticking.current = true

      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY

        // Toujours visible en haut de page
        if (currentScrollY < 20) {
          setIsVisible(true)
          setIsScrolled(false)
        } else {
          setIsScrolled(true)

          // Hysteresis de 10px pour éviter les micro-changements
          if (currentScrollY > lastScrollY.current + 10) {
            // Scroll vers le bas - cacher
            setIsVisible(false)
          } else if (currentScrollY < lastScrollY.current - 10) {
            // Scroll vers le haut - montrer
            setIsVisible(true)
          }
        }

        lastScrollY.current = currentScrollY
        ticking.current = false
      })
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return { isVisible, isScrolled }
}
