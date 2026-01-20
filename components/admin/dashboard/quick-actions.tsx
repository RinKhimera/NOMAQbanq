"use client"

import {
  IconBolt,
  IconCash,
  IconFileText,
  IconPlus,
  IconUsers,
} from "@tabler/icons-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface QuickAction {
  label: string
  href?: string
  onClick?: () => void
  icon: React.ElementType
  color: "slate" | "blue" | "emerald" | "amber"
}

interface QuickActionsProps {
  onManualPaymentClick?: () => void
}

const colorStyles = {
  slate:
    "hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/50",
  blue: "hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-700 dark:hover:bg-blue-900/20",
  emerald:
    "hover:border-emerald-300 hover:bg-emerald-50 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20",
  amber:
    "hover:border-amber-300 hover:bg-amber-50 dark:hover:border-amber-700 dark:hover:bg-amber-900/20",
}

const iconStyles = {
  slate:
    "text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400",
  blue: "text-blue-500 group-hover:text-blue-600 dark:group-hover:text-blue-400",
  emerald:
    "text-emerald-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
  amber:
    "text-amber-500 group-hover:text-amber-600 dark:group-hover:text-amber-400",
}

function ActionButton({ action }: { action: QuickAction }) {
  const Icon = action.icon

  const content = (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-all duration-200 dark:border-gray-800 dark:bg-gray-900",
        colorStyles[action.color],
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 transition-colors dark:bg-gray-800",
          action.color === "blue" &&
            "group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30",
          action.color === "emerald" &&
            "group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30",
          action.color === "amber" &&
            "group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30",
          action.color === "slate" &&
            "group-hover:bg-slate-200 dark:group-hover:bg-slate-700",
        )}
      >
        <Icon
          className={cn("h-4 w-4 transition-colors", iconStyles[action.color])}
        />
      </div>
      <span className="text-sm font-medium text-gray-700 transition-colors group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white">
        {action.label}
      </span>
    </div>
  )

  if (action.href) {
    return (
      <Link href={action.href} className="block">
        {content}
      </Link>
    )
  }

  return (
    <button
      onClick={action.onClick}
      className="block w-full cursor-pointer text-left"
    >
      {content}
    </button>
  )
}

export function QuickActions({ onManualPaymentClick }: QuickActionsProps) {
  const actions: QuickAction[] = [
    {
      label: "Ajouter une question",
      href: "/admin/questions",
      icon: IconPlus,
      color: "blue",
    },
    {
      label: "Créer un examen",
      href: "/admin/exams/create",
      icon: IconFileText,
      color: "emerald",
    },
    {
      label: "Gérer les utilisateurs",
      href: "/admin/users",
      icon: IconUsers,
      color: "slate",
    },
    {
      label: "Enregistrer un paiement",
      onClick: onManualPaymentClick,
      icon: IconCash,
      color: "amber",
    },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">
          Actions rapides
        </CardTitle>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <IconBolt className="h-5 w-5 text-slate-500" />
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {actions.map((action) => (
          <ActionButton key={action.label} action={action} />
        ))}
      </CardContent>
    </Card>
  )
}
