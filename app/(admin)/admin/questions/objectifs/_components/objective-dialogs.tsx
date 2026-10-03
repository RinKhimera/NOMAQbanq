"use client"

import { Merge, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { Input } from "@/components/ui/input"
import {
  createObjective,
  deleteObjective,
  mergeObjectives,
  renameObjective,
} from "@/features/objectives/actions"
import type { ObjectiveEntryView } from "@/features/objectives/groups"
import { objectiveLabelError } from "@/features/objectives/label"
import { callAction } from "@/lib/safe-action"
import { questionsLabel } from "./objectives-model"

export type ObjectiveDialog =
  | { kind: "create" }
  | { kind: "rename"; entry: ObjectiveEntryView }
  | { kind: "merge"; entry: ObjectiveEntryView }
  | { kind: "delete"; entry: ObjectiveEntryView }

type DialogProps = {
  dialog: ObjectiveDialog
  /** Le référentiel, valeurs invalides exclues. */
  objectives: readonly ObjectiveEntryView[]
  onClose: () => void
  onDone: (message: string) => void
}

const FieldError = ({ message }: { message: string | null }) =>
  message ? (
    <p role="alert" className="text-danger-ink text-[0.8125rem]">
      {message}
    </p>
  ) : null

const LabelField = ({
  id,
  value,
  onChange,
  error,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  error: string | null
}) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-sm font-medium">
      Libellé
    </label>
    <Input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={!!error || undefined}
    />
    <FieldError message={error} />
  </div>
)

/**
 * Dialogues de gestion du référentiel. Les règles d'un libellé sont vérifiées
 * ici pour un retour immédiat, puis par le serveur, qui seul connaît les
 * doublons.
 */
export const ObjectiveDialogs = ({
  dialog,
  objectives,
  onClose,
  onDone,
}: DialogProps) => {
  const entry = dialog.kind === "create" ? null : dialog.entry
  const [label, setLabel] = useState(entry?.label ?? "")
  const [targetId, setTargetId] = useState("")
  const [mergeLabel, setMergeLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const target = objectives.find((o) => o.id === targetId)
  const finalLabel = mergeLabel ?? target?.label ?? ""

  const run = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    message: string,
  ) => {
    const res = await callAction(action)
    if (!res.success) {
      setError(res.error ?? "Erreur serveur. Réessayez.")
      return false
    }
    onDone(message)
    return true
  }
  const checked = (value: string, then: () => Promise<boolean>) => {
    const ruleError = objectiveLabelError(value)
    if (ruleError) {
      setError(ruleError)
      return false
    }
    return then()
  }
  const common = {
    open: true,
    onOpenChange: (open: boolean) => !open && onClose(),
  }

  if (dialog.kind === "create")
    return (
      <ConfirmDialog
        {...common}
        icon={Plus}
        title="Nouvel objectif"
        description="Il entre au référentiel revu, et se choisit aussitôt dans le formulaire des questions."
        confirmLabel="Créer"
        pendingLabel="Création…"
        onConfirm={() =>
          checked(label, () =>
            run(
              () => createObjective({ label }),
              `« ${label.trim()} » ajouté au référentiel`,
            ),
          )
        }
      >
        <LabelField
          id="objective-create"
          value={label}
          onChange={setLabel}
          error={error}
        />
      </ConfirmDialog>
    )

  if (dialog.kind === "rename")
    return (
      <ConfirmDialog
        {...common}
        icon={Pencil}
        title={`Renommer « ${dialog.entry.label} »`}
        description={`Le nouveau libellé s'affiche partout, sur ${questionsLabel(dialog.entry.questionCount)}.`}
        confirmLabel="Renommer"
        pendingLabel="Enregistrement…"
        onConfirm={() =>
          checked(label, () =>
            run(
              () => renameObjective({ id: dialog.entry.id, label }),
              `Renommé en « ${label.trim()} »`,
            ),
          )
        }
      >
        <LabelField
          id="objective-rename"
          value={label}
          onChange={setLabel}
          error={error}
        />
      </ConfirmDialog>
    )

  if (dialog.kind === "merge")
    return (
      <ConfirmDialog
        {...common}
        icon={Merge}
        title={`Fusionner « ${dialog.entry.label} »`}
        description={`Ses ${questionsLabel(dialog.entry.questionCount)} passent sur l'objectif choisi, puis il disparaît du référentiel.`}
        confirmLabel="Fusionner"
        pendingLabel="Fusion…"
        confirmDisabled={!target}
        onConfirm={() =>
          checked(finalLabel, () =>
            run(
              () =>
                mergeObjectives({
                  keepId: targetId,
                  mergeIds: [dialog.entry.id],
                  label: finalLabel,
                }),
              `Fusionné sous « ${finalLabel.trim()} »`,
            ),
          )
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="objective-merge-target"
              className="text-sm font-medium"
            >
              Objectif gardé
            </label>
            <SearchableSelect
              id="objective-merge-target"
              value={targetId}
              onChange={(id) => {
                setTargetId(id)
                setMergeLabel(null)
                setError(null)
              }}
              options={objectives
                .filter((o) => o.id !== dialog.entry.id)
                .map((o) => ({
                  value: o.id,
                  label: o.label,
                  hint: String(o.questionCount),
                }))}
              placeholder="Choisir un objectif"
              searchPlaceholder="Rechercher un objectif"
              emptyText="Aucun objectif ne correspond"
            />
          </div>
          {target && (
            <LabelField
              id="objective-merge-label"
              value={finalLabel}
              onChange={setMergeLabel}
              error={error}
            />
          )}
          {!target && <FieldError message={error} />}
        </div>
      </ConfirmDialog>
    )

  return (
    <ConfirmDialog
      {...common}
      icon={Trash2}
      variant="destructive"
      title={`Supprimer « ${dialog.entry.label} » ?`}
      description="Seul un objectif que plus aucune question n'utilise se supprime ; sinon, fusionnez-le."
      confirmLabel="Supprimer"
      pendingLabel="Suppression…"
      onConfirm={() =>
        run(
          () => deleteObjective(dialog.entry.id),
          `« ${dialog.entry.label} » supprimé`,
        )
      }
    >
      <FieldError message={error} />
    </ConfirmDialog>
  )
}
