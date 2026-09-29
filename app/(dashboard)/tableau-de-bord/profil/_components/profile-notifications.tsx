"use client"

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
    // Pas de `disabled` pendant l'envoi : l'interrupteur perdrait le focus.
    if (busy) return
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
        id="notif-exam-results"
        label="Résultats d'examen"
        description="Quand un examen blanc ferme et que vos résultats sont publiés."
        checked={prefs.examResults}
        pending={busy}
        testId="notif-toggle-exam-results"
        onCheckedChange={(v) => update({ ...prefs, examResults: v })}
      />
      <NotifRow
        id="notif-access-expiry"
        label="Fin d'accès"
        description="Un rappel quand un accès expire dans 7 jours ou moins."
        checked={prefs.accessExpiry}
        pending={busy}
        testId="notif-toggle-access-expiry"
        onCheckedChange={(v) => update({ ...prefs, accessExpiry: v })}
      />
      <NotifRow
        id="notif-marketing"
        label="Rappels et suggestions"
        description="Relance après 21 jours d'inactivité et rappel d'un paiement non finalisé."
        checked={prefs.marketing}
        pending={busy}
        testId="notif-toggle-marketing"
        onCheckedChange={(v) => update({ ...prefs, marketing: v })}
      />
    </div>
  )
}

const NotifRow = ({
  id,
  label,
  description,
  checked,
  pending,
  testId,
  onCheckedChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  pending: boolean
  testId: string
  onCheckedChange: (v: boolean) => void
}) => (
  <div className="border-line flex items-center justify-between gap-4 border-t py-3.5 first:border-t-0 first:pt-0">
    <div className="flex min-w-0 flex-col gap-0.5">
      <label htmlFor={id} className="text-ink text-[0.9375rem]">
        {label}
      </label>
      <span id={`${id}-description`} className="text-ink-3 text-[0.8125rem]">
        {description}
      </span>
    </div>
    {/* Zone de toucher de 44 px autour de l'interrupteur, sous 768 px. */}
    <span className="grid shrink-0 place-items-center max-md:size-11">
      <Switch
        id={id}
        checked={checked}
        aria-disabled={pending}
        aria-describedby={`${id}-description`}
        onCheckedChange={onCheckedChange}
        data-testid={testId}
      />
    </span>
  </div>
)
