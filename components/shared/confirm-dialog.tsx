"use client"

import type { LucideIcon } from "lucide-react"
import { type MouseEvent, type ReactNode, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type ConfirmDialogProps = {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  confirmLabel: ReactNode
  pendingLabel?: ReactNode
  cancelLabel?: string
  variant?: "default" | "destructive"
  icon?: LucideIcon
  /**
   * Une promesse garde le dialogue ouvert et verrouillé jusqu'à son issue ;
   * `false` signale un échec et le laisse ouvert pour réessayer.
   */
  onConfirm: () => unknown
  confirmDisabled?: boolean
  confirmTestId?: string
  /** Attente portée par l'appelant (ex. `useTransition`). */
  isPending?: boolean
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export const ConfirmDialog = ({
  title,
  description,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Annuler",
  variant = "default",
  icon: Icon,
  onConfirm,
  confirmDisabled = false,
  confirmTestId,
  isPending = false,
  trigger,
  open,
  onOpenChange,
  className,
}: ConfirmDialogProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const pending = isPending || running
  const isOpen = open ?? uncontrolledOpen
  const destructive = variant === "destructive"

  const setOpen = (next: boolean) => {
    if (pending && !next) return
    setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  const handleConfirm = async (event: MouseEvent) => {
    // L'action Radix fermerait avant l'issue : c'est l'issue qui décide.
    event.preventDefault()
    setRunning(true)
    try {
      const outcome = await onConfirm()
      if (outcome !== false) {
        setUncontrolledOpen(false)
        onOpenChange?.(false)
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent className={cn("max-w-md rounded-2xl", className)}>
        <AlertDialogHeader>
          {Icon && (
            <div
              className={cn(
                "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full",
                destructive
                  ? "bg-red-100 dark:bg-red-900/30"
                  : "bg-blue-100 dark:bg-blue-900/30",
              )}
            >
              <Icon
                className={cn(
                  "h-7 w-7",
                  destructive
                    ? "text-red-600 dark:text-red-400"
                    : "text-blue-600 dark:text-blue-400",
                )}
              />
            </div>
          )}
          <AlertDialogTitle className={cn("text-xl", Icon && "text-center")}>
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className={cn(Icon && "text-center")}>
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {children}

        <AlertDialogFooter className="mt-2 gap-3 sm:gap-3">
          <AlertDialogCancel disabled={pending} className="flex-1 rounded-xl">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid={confirmTestId}
            onClick={handleConfirm}
            disabled={pending || confirmDisabled}
            className={cn(
              "flex-1 rounded-xl",
              destructive &&
                "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700",
            )}
          >
            {pending ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                {pendingLabel ?? confirmLabel}
              </span>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
