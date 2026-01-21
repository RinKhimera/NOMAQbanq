"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { IconCheck, IconPencil, IconX } from "@tabler/icons-react"
import { Loader2, type LucideIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type InlineEditFieldProps = {
  label: string
  icon: LucideIcon
  iconColorClass: string
  iconBgClass: string
  value: string
  placeholder?: string
  emptyText?: string
  schema: z.ZodType<string>
  maxLength?: number
  showCharCount?: boolean
  inputType?: "input" | "textarea"
  textareaRows?: number
  onSave: (value: string) => Promise<{ success: boolean; error?: string }>
  readOnly?: boolean
  badge?: React.ReactNode
}

export const InlineEditField = ({
  label,
  icon: Icon,
  iconColorClass,
  iconBgClass,
  value,
  placeholder = "",
  emptyText = "Non défini",
  schema,
  maxLength,
  showCharCount = false,
  inputType = "input",
  textareaRows = 3,
  onSave,
  readOnly = false,
  badge,
}: InlineEditFieldProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const formSchema = z.object({ value: schema })
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { value: value || "" },
  })

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      const length = inputRef.current.value.length
      inputRef.current.setSelectionRange(length, length)
    }
  }, [isEditing])

  // Reset form when value prop changes
  useEffect(() => {
    if (!isEditing) {
      form.reset({ value: value || "" })
    }
  }, [value, isEditing, form])

  const handleEdit = () => {
    if (readOnly) return
    setIsEditing(true)
  }

  const handleCancel = () => {
    form.reset({ value: value || "" })
    setIsEditing(false)
  }

  const handleSubmit = async (data: { value: string }) => {
    if (data.value === value) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    const result = await onSave(data.value)
    setIsSaving(false)

    if (result.success) {
      setIsEditing(false)
    } else {
      form.setError("value", { message: result.error || "Erreur" })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel()
    }
    // Enter to submit only for single-line inputs
    if (e.key === "Enter" && inputType === "input" && !e.shiftKey) {
      e.preventDefault()
      form.handleSubmit(handleSubmit)()
    }
  }

  const displayValue = value || emptyText
  // eslint-disable-next-line react-hooks/incompatible-library
  const currentValue = form.watch("value") ?? ""
  const errorMessage = form.formState.errors.value?.message

  // Properly handle ref combination for react-hook-form
  const { ref: registerRef, ...registerProps } = form.register("value")

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: -8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
      }

  return (
    <div
      className={cn(
        "group relative rounded-xl p-4 transition-all duration-200",
        !readOnly && "hover:bg-gray-50/80 dark:hover:bg-gray-800/50",
        isEditing && "bg-gray-50/80 dark:bg-gray-800/50",
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200",
            iconBgClass,
            isEditing && "scale-95",
          )}
        >
          <Icon className={cn("h-5 w-5", iconColorClass)} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
            {label}
          </p>

          <AnimatePresence mode="wait" initial={false}>
            {isEditing ? (
              <motion.form
                key="editing"
                {...motionProps}
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-3"
              >
                {inputType === "input" ? (
                  <Input
                    {...registerProps}
                    ref={(e) => {
                      registerRef(e)
                      inputRef.current = e
                    }}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                    className={cn(
                      "h-11 rounded-xl border-gray-200 bg-white text-base transition-all",
                      "focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
                      "dark:border-gray-700 dark:bg-gray-900 dark:focus:ring-blue-900/50",
                      errorMessage && "border-red-300 focus:border-red-400 focus:ring-red-100",
                    )}
                    aria-label={label}
                    aria-invalid={!!errorMessage}
                  />
                ) : (
                  <Textarea
                    {...registerProps}
                    ref={(e) => {
                      registerRef(e)
                      inputRef.current = e
                    }}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    rows={textareaRows}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                    className={cn(
                      "rounded-xl border-gray-200 bg-white text-base transition-all resize-none",
                      "focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
                      "dark:border-gray-700 dark:bg-gray-900 dark:focus:ring-blue-900/50",
                      errorMessage && "border-red-300 focus:border-red-400 focus:ring-red-100",
                    )}
                    aria-label={label}
                    aria-invalid={!!errorMessage}
                  />
                )}

                {/* Character count & error */}
                <div className="flex items-center justify-between">
                  {errorMessage ? (
                    <p className="text-sm text-red-500" role="alert">
                      {errorMessage}
                    </p>
                  ) : showCharCount && maxLength ? (
                    <p
                      className={cn(
                        "text-xs transition-colors",
                        currentValue.length > maxLength * 0.9
                          ? "text-amber-500"
                          : "text-gray-400",
                      )}
                    >
                      {currentValue.length}/{maxLength} caractères
                    </p>
                  ) : (
                    <span />
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSaving}
                    className={cn(
                      "rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4",
                      "hover:from-blue-700 hover:to-indigo-700",
                      "transition-all duration-200",
                    )}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <IconCheck className="mr-1.5 h-4 w-4" />
                    )}
                    {isSaving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="rounded-lg px-4"
                  >
                    <IconX className="mr-1.5 h-4 w-4" />
                    Annuler
                  </Button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="display"
                {...motionProps}
                className="flex items-center gap-3"
              >
                {badge ? (
                  badge
                ) : (
                  <p
                    className={cn(
                      "text-lg font-semibold leading-relaxed",
                      value
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-400 italic dark:text-gray-500",
                    )}
                  >
                    {displayValue}
                  </p>
                )}

                {/* Edit button */}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={handleEdit}
                    className={cn(
                      "cursor-pointer rounded-lg p-2 transition-all duration-200",
                      "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
                      "dark:hover:text-gray-300 dark:hover:bg-gray-800",
                      "opacity-0 group-hover:opacity-100 focus:opacity-100",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                    )}
                    aria-label={`Modifier ${label.toLowerCase()}`}
                  >
                    <IconPencil className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
