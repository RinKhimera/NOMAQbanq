"use client"

import { IconBell } from "@tabler/icons-react"
import { useState } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { updateNotificationPreferences } from "@/features/notifications/actions"
import type { NotificationPreferences } from "@/features/notifications/dal"
import { callAction } from "@/lib/safe-action"

export const ProfileNotifications = ({
  preferences,
}: {
  preferences: NotificationPreferences
}) => {
  const [prefs, setPrefs] = useState(preferences)
  const [busy, setBusy] = useState(false)

  const update = async (next: NotificationPreferences) => {
    const prev = prefs
    setPrefs(next) // optimistic
    setBusy(true)
    const res = await callAction(() => updateNotificationPreferences(next))
    setBusy(false)
    if (!res.success) {
      setPrefs(prev) // rollback
      toast.error(res.error ?? "Échec de la mise à jour")
      return
    }
    toast.success("Préférences mises à jour")
  }

  return (
    <div className="flex flex-col">
      <NotifRow
        label="Résultats d'examen"
        description="Un email quand vos résultats d'examen sont disponibles."
        checked={prefs.examResults}
        disabled={busy}
        testId="notif-toggle-exam-results"
        onCheckedChange={(v) => update({ ...prefs, examResults: v })}
      />
      <NotifRow
        label="Fin d'accès"
        description="Un rappel avant l'expiration de votre accès."
        checked={prefs.accessExpiry}
        disabled={busy}
        testId="notif-toggle-access-expiry"
        onCheckedChange={(v) => update({ ...prefs, accessExpiry: v })}
      />
    </div>
  )
}

const NotifRow = ({
  label,
  description,
  checked,
  disabled,
  testId,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled: boolean
  testId: string
  onCheckedChange: (v: boolean) => void
}) => (
  <div className="flex items-start gap-4 rounded-xl p-4">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/30">
      <IconBell className="h-5 w-5 text-rose-600 dark:text-rose-400" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="font-medium text-gray-900 dark:text-white">{label}</p>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
    <div className="shrink-0">
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        data-testid={testId}
      />
    </div>
  </div>
)
