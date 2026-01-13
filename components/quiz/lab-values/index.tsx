"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { LAB_VALUES_DATA } from "./lab-values-data"
import { LabValueCategory, UnitSystem } from "./types"

type LabValuesProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

const CategoryPill = ({
  category,
  isActive,
  onClick,
}: {
  category: LabValueCategory
  isActive: boolean
  onClick: () => void
}) => (
  <motion.button
    type="button"
    onClick={onClick}
    className={cn(
      "relative cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
      isActive
        ? "text-white"
        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
    )}
    whileTap={{ scale: 0.97 }}
  >
    {isActive && (
      <motion.div
        layoutId="active-category"
        className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/90 to-teal-600/90 shadow-[0_2px_8px_rgba(6,182,212,0.3)]"
        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
      />
    )}
    <span className="relative z-10">{category.name}</span>
  </motion.button>
)

const UnitToggle = ({
  unitSystem,
  onToggle,
}: {
  unitSystem: UnitSystem
  onToggle: () => void
}) => (
  <button
    type="button"
    onClick={onToggle}
    className={cn(
      "relative flex h-8 cursor-pointer items-center gap-0 rounded-full p-1",
      "bg-slate-800/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
    )}
    aria-label="Basculer entre unités US et SI"
  >
    <motion.div
      className="absolute top-1 h-6 w-10 rounded-full bg-gradient-to-r from-amber-500/90 to-amber-600/90 shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
      animate={{ left: unitSystem === "us" ? 4 : 44 }}
      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
    />
    <span
      className={cn(
        "relative z-10 w-10 text-center text-xs font-semibold transition-colors",
        unitSystem === "us" ? "text-white" : "text-slate-500",
      )}
    >
      US
    </span>
    <span
      className={cn(
        "relative z-10 w-10 text-center text-xs font-semibold transition-colors",
        unitSystem === "si" ? "text-white" : "text-slate-500",
      )}
    >
      SI
    </span>
  </button>
)

const LabValueRow = ({
  name,
  value,
  unit,
  index,
}: {
  name: string
  value: string
  unit: string
  index: number
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: index * 0.015, duration: 0.15 }}
    className={cn(
      "group flex items-center justify-between gap-3 px-4 py-2.5",
      "transition-colors hover:bg-slate-800/30",
      index % 2 === 0 ? "bg-slate-900/20" : "bg-transparent",
    )}
  >
    <span className="flex-1 min-w-0 text-sm font-medium text-slate-200 group-hover:text-white transition-colors truncate">
      {name}
    </span>
    <div className="flex items-baseline gap-2 shrink-0">
      <span
        className="font-mono text-sm tabular-nums text-cyan-300 whitespace-nowrap"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {value}
      </span>
      {unit && (
        <span className="text-[11px] text-slate-500 whitespace-nowrap">
          {unit}
        </span>
      )}
    </div>
  </motion.div>
)

export const LabValues = ({ isOpen, onOpenChange }: LabValuesProps) => {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("si")
  const [activeCategory, setActiveCategory] = useState(LAB_VALUES_DATA[0].id)

  const currentCategory = LAB_VALUES_DATA.find((c) => c.id === activeCategory)

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex h-[600px] w-[95vw] max-w-[500px] flex-col overflow-hidden rounded-2xl border-0 p-0",
          "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_-12px_rgba(0,0,0,0.8)]",
        )}
        aria-describedby="lab-values-description"
        showCloseButton={false}
      >
        <p id="lab-values-description" className="sr-only">
          Référence des valeurs normales de laboratoire pour les examens
          médicaux.
        </p>

        {/* Header */}
        <div className="relative shrink-0 px-5 pt-5 pb-4">
          {/* Subtle grid pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: "20px 20px",
            }}
          />

          {/* Title and unit toggle row */}
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-lg font-semibold text-slate-100">
              Valeurs de laboratoire
            </DialogTitle>
            <UnitToggle
              unitSystem={unitSystem}
              onToggle={() => setUnitSystem(unitSystem === "us" ? "si" : "us")}
            />
          </div>

          {/* Category pills */}
          <div className="mt-4 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {LAB_VALUES_DATA.map((category) => (
              <CategoryPill
                key={category.id}
                category={category}
                isActive={activeCategory === category.id}
                onClick={() => setActiveCategory(category.id)}
              />
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className="h-px shrink-0 bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />

        {/* Column headers - Fixed outside scroll */}
        <div className="shrink-0 flex items-center justify-between gap-3 bg-slate-900/95 px-4 py-2 border-b border-slate-800/30">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Paramètre
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Valeur normale
          </span>
        </div>

        {/* Values list - Scrollable area with fixed height */}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeCategory}-${unitSystem}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="py-1"
            >
              {currentCategory?.values.map((labValue, index) => (
                <LabValueRow
                  key={labValue.id}
                  name={labValue.name}
                  value={unitSystem === "us" ? labValue.usValue : labValue.siValue}
                  unit={unitSystem === "us" ? labValue.usUnit : labValue.siUnit}
                  index={index}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer with count */}
        <div className="shrink-0 border-t border-slate-800/50 bg-slate-900/50 px-5 py-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {currentCategory?.values.length} paramètres •{" "}
              {unitSystem === "us" ? "Unités US" : "Unités SI"}
            </span>
            <span className="text-slate-600">Esc pour fermer</span>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="h-1 shrink-0 bg-gradient-to-r from-teal-500/0 via-teal-500/50 to-teal-500/0" />
      </DialogContent>
    </Dialog>
  )
}
