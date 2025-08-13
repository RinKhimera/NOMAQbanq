"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AtSign, Check, Edit2, FileText, User, X } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { userProfileSchema } from "../_schemas/user-profile.schema"

type EditableField = "name" | "username" | "bio"

interface ProfileFieldEditorProps {
  field: EditableField
  value: string
  onSave: (field: EditableField, value: string) => void
  placeholder?: string
}

const unifiedSchema = z.object({
  name: userProfileSchema.shape.name.optional(),
  username: userProfileSchema.shape.username.optional(),
  bio: userProfileSchema.shape.bio.optional(),
})

const fieldIcons = {
  name: User,
  username: AtSign,
  bio: FileText,
}

const fieldLabels = {
  name: "Nom",
  username: "Nom d'utilisateur",
  bio: "Biographie",
}

export function ProfileFieldEditor({
  field,
  value,
  onSave,
  placeholder,
}: ProfileFieldEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const Icon = fieldIcons[field]

  const form = useForm<{ name?: string; username?: string; bio?: string }>({
    resolver: zodResolver(unifiedSchema),
    defaultValues: { [field]: value } as {
      name?: string
      username?: string
      bio?: string
    },
  })

  const handleSave = (data: {
    name?: string
    username?: string
    bio?: string
  }) => {
    onSave(field, (data as Record<string, string>)[field] ?? "")
    setIsEditing(false)
  }

  const handleCancel = () => {
    form.reset({ [field]: value })
    setIsEditing(false)
  }

  if (!isEditing) {
    return (
      <div className="group bg-card hover:bg-muted flex items-center justify-between rounded-lg border p-3 transition-colors dark:hover:bg-gray-900">
        <div className="flex items-center gap-3">
          <Icon className="dark:text-muted-foreground h-4 w-4 shrink-0 text-blue-600" />
          <div>
            <p className="text-muted-foreground text-sm font-medium">
              {fieldLabels[field]}
            </p>
            <p className="text-base">
              {value || (
                <span className="text-muted-foreground italic">
                  Non renseigné
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSave)}
      className="bg-card rounded-lg border p-3"
    >
      <div className="mb-3 flex items-center gap-3">
        <Icon className="dark:text-muted-foreground h-4 w-4 shrink-0 text-blue-600" />
        <p className="text-muted-foreground text-sm font-medium">
          {fieldLabels[field]}
        </p>
      </div>

      <div className="space-y-2">
        <Form {...form}>
          <FormField
            control={form.control}
            name={
              field as keyof { name: string; username: string; bio: string }
            }
            render={({ field: rhfField }) => (
              <FormItem>
                <FormLabel className="sr-only">{fieldLabels[field]}</FormLabel>
                <FormControl>
                  {field === "bio" ? (
                    <Textarea
                      {...rhfField}
                      placeholder={placeholder}
                      rows={3}
                      className="resize-none"
                    />
                  ) : (
                    <Input {...rhfField} placeholder={placeholder} />
                  )}
                </FormControl>
                {field === "bio" && (
                  <p className="text-muted-foreground text-xs">
                    {rhfField.value?.length || 0}/160 caractères
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCancel}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          variant="none"
          className="bg-green-500 text-white hover:bg-green-700"
          type="submit"
          size="sm"
          disabled={form.watch(field) === value}
        >
          Modifier
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </form>
  )
}
