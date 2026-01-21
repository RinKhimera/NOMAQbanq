"use client"

import { motion, useScroll, useSpring } from "motion/react"

type PageType = "conditions" | "confidentialite" | "cookies"

interface LegalProgressBarProps {
  pageType: PageType
}

const pageColors: Record<PageType, { from: string; to: string }> = {
  conditions: {
    from: "rgb(59, 130, 246)",
    to: "rgb(99, 102, 241)",
  },
  confidentialite: {
    from: "rgb(139, 92, 246)",
    to: "rgb(168, 85, 247)",
  },
  cookies: {
    from: "rgb(245, 158, 11)",
    to: "rgb(251, 146, 60)",
  },
}

export const LegalProgressBar = ({ pageType }: LegalProgressBarProps) => {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  const colors = pageColors[pageType]

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[100] h-[3px] origin-left"
      style={{
        scaleX,
        background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
      }}
    />
  )
}
