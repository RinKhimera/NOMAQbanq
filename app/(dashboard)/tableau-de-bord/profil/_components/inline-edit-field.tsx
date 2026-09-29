"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type InlineEditFieldProps = {
  label: string
  value: string
  placeholder?: string
  emptyText?: string
  schema: z.ZodType<string>
  maxLength?: number
  showCharCount?: boolean
  inputType?: "input" | "textarea"
  textareaRows?: number
  onSave: (value: string) => Promise<{ success: boolean; error?: string }>
  /** Préfixe data-testid stable (ex. "profile-field-name" → -edit/-input/-save). */
  testId?: string
}

export const InlineEditField = ({
  label,
  value,
  placeholder = "",
  emptyText = "Non défini",
  schema,
  maxLength,
  showCharCount = false,
  inputType = "input",
  textareaRows = 3,
  onSave,
  testId,
}: InlineEditFieldProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const editRef = useRef<HTMLButtonElement>(null)
  // Le crayon n'existe pas pendant l'édition : à la sortie, le focus lui revient
  // au lieu de tomber sur <body>.
  const returnFocus = useRef(false)

  const formSchema = z.object({ value: schema })
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { value: value || "" },
  })

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      const length = inputRef.current.value.length
      inputRef.current.setSelectionRange(length, length)
    } else if (!isEditing && returnFocus.current) {
      returnFocus.current = false
      editRef.current?.focus()
    }
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) {
      form.reset({ value: value || "" })
    }
  }, [value, isEditing, form])

  const stopEditing = () => {
    returnFocus.current = true
    setIsEditing(false)
  }

  const handleCancel = () => {
    form.reset({ value: value || "" })
    stopEditing()
  }

  const handleSubmit = async (data: { value: string }) => {
    if (data.value === value) {
      stopEditing()
      return
    }

    setIsSaving(true)
    const result = await onSave(data.value)
    setIsSaving(false)

    if (result.success) {
      stopEditing()
    } else {
      form.setError("value", { message: result.error || "Erreur" })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel()
    }
    // Entrée enregistre un champ d'une ligne ; une biographie garde ses retours.
    if (e.key === "Enter" && inputType === "input" && !e.shiftKey) {
      e.preventDefault()
      form.handleSubmit(handleSubmit)()
    }
  }

  // eslint-disable-next-line react-hooks/incompatible-library
  const currentValue = String(form.watch("value") ?? "")
  const errorMessage = form.formState.errors.value?.message
  const errorId = testId ? `${testId}-error` : undefined

  const { ref: registerRef, ...registerProps } = form.register("value")
  const fieldProps = {
    ...registerProps,
    ref: (e: HTMLInputElement | HTMLTextAreaElement | null) => {
      registerRef(e)
      inputRef.current = e
    },
    "data-testid": testId ? `${testId}-input` : undefined,
    placeholder,
    maxLength,
    onKeyDown: handleKeyDown,
    readOnly: isSaving,
    "aria-label": label,
    "aria-invalid": !!errorMessage,
    "aria-describedby": errorMessage ? errorId : undefined,
  }

  return (
    <div
      data-testid={testId}
      className="group border-line grid grid-cols-[9.375rem_minmax(0,1fr)_auto] items-center gap-4 border-t py-3.5 first:border-t-0 first:pt-0 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-1.5"
    >
      <span className="text-ink-3 text-[0.8125rem] max-md:col-span-full">
        {label}
      </span>

      {isEditing ? (
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="col-span-2 flex min-w-0 flex-col gap-2 max-md:col-span-full"
        >
          {inputType === "input" ? (
            <Input {...fieldProps} className="max-md:h-11" />
          ) : (
            <Textarea {...fieldProps} rows={textareaRows} />
          )}

          {errorMessage ? (
            <p id={errorId} className="text-danger-ink text-sm" role="alert">
              {errorMessage}
            </p>
          ) : (
            showCharCount &&
            maxLength && (
              <p className="text-ink-3 font-mono text-xs">
                {currentValue.length} / {maxLength}
              </p>
            )
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              aria-disabled={isSaving}
              onClick={(e) => {
                if (isSaving) e.preventDefault()
              }}
              data-testid={testId ? `${testId}-save` : undefined}
              className="max-md:h-11"
            >
              {isSaving && <Spinner size="sm" />}
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              aria-disabled={isSaving}
              className="max-md:h-11"
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <>
          <span
            className={cn(
              "min-w-0 text-[0.9375rem] wrap-anywhere",
              value ? "text-ink" : "text-ink-3",
            )}
          >
            {value || emptyText}
          </span>
          <Button
            ref={editRef}
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            data-testid={testId ? `${testId}-edit` : undefined}
            aria-label={`Modifier ${label.toLowerCase()}`}
            className="max-md:size-11"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
        </>
      )}
    </div>
  )
}
