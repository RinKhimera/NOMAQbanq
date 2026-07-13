"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { IconKey } from "@tabler/icons-react"
import {
  type Control,
  type FieldValues,
  type Path,
  useForm,
} from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { setAccountPassword } from "@/features/users/actions"
import { authClient } from "@/lib/auth-client"
import { mapAuthError } from "@/lib/auth-errors"
import { callAction } from "@/lib/safe-action"
import {
  type ChangePasswordFormValues,
  type ResetPasswordFormValues,
  changePasswordSchema,
  resetPasswordSchema,
} from "@/schemas/auth"

type Props = { mode: "change" | "set" }

export const ProfilePassword = ({ mode }: Props) => {
  if (mode === "set") return <SetPasswordForm />
  return <ChangePasswordForm />
}

const SetPasswordForm = () => {
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  const onSubmit = async (values: ResetPasswordFormValues) => {
    const res = await callAction(() =>
      setAccountPassword({ newPassword: values.password }),
    )
    if (!res.success) {
      toast.error(res.error ?? "Impossible de définir le mot de passe")
      return
    }
    toast.success(
      "Mot de passe défini — vous pouvez désormais vous connecter par email",
    )
    form.reset()
    location.reload()
  }

  return (
    <PasswordCard title="Définir un mot de passe">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <PasswordField
            control={form.control}
            name="password"
            label="Nouveau mot de passe"
            testId="set-new-password"
          />
          <PasswordField
            control={form.control}
            name="confirmPassword"
            label="Confirmer le mot de passe"
            testId="set-confirm-password"
          />
          <SubmitButton
            pending={form.formState.isSubmitting}
            label="Définir le mot de passe"
            testId="set-password-submit"
          />
        </form>
      </Form>
    </PasswordCard>
  )
}

const ChangePasswordForm = () => {
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const onSubmit = async (values: ChangePasswordFormValues) => {
    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: true,
    })
    if (error) {
      toast.error(mapAuthError(error).message)
      return
    }
    toast.success("Mot de passe modifié avec succès")
    form.reset()
  }

  return (
    <PasswordCard title="Modifier le mot de passe">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <PasswordField
            control={form.control}
            name="currentPassword"
            label="Mot de passe actuel"
            testId="security-current-password"
            autoComplete="current-password"
          />
          <PasswordField
            control={form.control}
            name="newPassword"
            label="Nouveau mot de passe"
            testId="security-new-password"
          />
          <PasswordField
            control={form.control}
            name="confirmPassword"
            label="Confirmer le nouveau mot de passe"
            testId="security-confirm-password"
          />
          <SubmitButton
            pending={form.formState.isSubmitting}
            label="Modifier le mot de passe"
            testId="security-submit"
          />
        </form>
      </Form>
    </PasswordCard>
  )
}

// --- sous-composants partagés ---

const PasswordCard = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <Card className="overflow-hidden rounded-2xl border-gray-100 shadow-sm dark:border-gray-800">
    <CardHeader className="block border-b border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
      <CardTitle className="flex items-center gap-3 text-lg">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/20">
          <IconKey className="h-5 w-5 text-white" />
        </div>
        <span className="font-display font-semibold text-gray-900 dark:text-white">
          {title}
        </span>
      </CardTitle>
    </CardHeader>
    <CardContent className="p-6">{children}</CardContent>
  </Card>
)

function PasswordField<T extends FieldValues>({
  control,
  name,
  label,
  testId,
  autoComplete = "new-password",
}: {
  control: Control<T>
  name: Path<T>
  label: string
  testId: string
  autoComplete?: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="password"
              autoComplete={autoComplete}
              placeholder="••••••••"
              data-testid={testId}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

const SubmitButton = ({
  pending,
  label,
  testId,
}: {
  pending: boolean
  label: string
  testId: string
}) => (
  <Button
    type="submit"
    variant="outline"
    disabled={pending}
    className="rounded-xl border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/40"
    data-testid={testId}
  >
    <IconKey className="mr-2 h-4 w-4" />
    {pending ? "En cours..." : label}
  </Button>
)
