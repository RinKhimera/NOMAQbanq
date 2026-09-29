"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  type Control,
  type FieldValues,
  type Path,
  useForm,
} from "react-hook-form"
import { toast } from "sonner"
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
import { Spinner } from "@/components/ui/spinner"
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

type Props = {
  mode: "change" | "set"
  /** Après un changement réussi : referme le formulaire. */
  onDone?: () => void
}

export const ProfilePassword = ({ mode, onDone }: Props) => {
  if (mode === "set") return <SetPasswordForm />
  return <ChangePasswordForm onDone={onDone} />
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
    <PasswordPanel>
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
            label="Enregistrer le mot de passe"
            testId="set-password-submit"
          />
        </form>
      </Form>
    </PasswordPanel>
  )
}

const ChangePasswordForm = ({ onDone }: { onDone?: () => void }) => {
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
    onDone?.()
  }

  return (
    <PasswordPanel note="Vos autres appareils seront déconnectés.">
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
            label="Enregistrer le mot de passe"
            testId="security-submit"
          />
        </form>
      </Form>
    </PasswordPanel>
  )
}

// --- sous-composants partagés ---

const PasswordPanel = ({
  note,
  children,
}: {
  note?: string
  children: React.ReactNode
}) => (
  <div className="flex max-w-105 flex-col gap-3 pt-1 pb-4 md:pl-8">
    {children}
    {note && <p className="text-ink-3 text-[0.8125rem]">{note}</p>}
  </div>
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
    size="sm"
    aria-disabled={pending}
    onClick={(e) => {
      if (pending) e.preventDefault()
    }}
    className="max-md:h-11"
    data-testid={testId}
  >
    {pending && <Spinner size="sm" />}
    {pending ? "Enregistrement…" : label}
  </Button>
)
