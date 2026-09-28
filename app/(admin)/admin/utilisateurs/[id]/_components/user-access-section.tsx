"use client"

import { Clock, Plus } from "lucide-react"
import { motion } from "motion/react"
import { AccessCard } from "@/components/shared/payments/access-card"
import { Button } from "@/components/ui/button"
import type { AccessInfo } from "@/features/payments/dal"

interface UserAccessSectionProps {
  examAccess: AccessInfo
  trainingAccess: AccessInfo
  onAddAccess: () => void
}

export const UserAccessSection = ({
  examAccess,
  trainingAccess,
  onAddAccess,
}: UserAccessSectionProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/50 dark:bg-gray-900"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <Clock className="h-5 w-5 text-slate-600" />
          Statut des accès
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddAccess}
          className="rounded-xl"
        >
          <Plus className="mr-1 h-4 w-4" />
          Ajouter accès
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AccessCard type="exam" access={examAccess} size="compact" />
        <AccessCard type="training" access={trainingAccess} size="compact" />
      </div>
    </motion.div>
  )
}
