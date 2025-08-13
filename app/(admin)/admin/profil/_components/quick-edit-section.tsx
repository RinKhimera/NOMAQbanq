"use client"

import { ProfileFieldEditor } from "./profile-field-editor"

type QuickEditSectionProps = {
  name: string
  username: string
  bio: string
  onSave: (field: "name" | "username" | "bio", value: string) => void
}

export function QuickEditSection(props: QuickEditSectionProps) {
  return (
    <div className="space-y-4">
      <ProfileFieldEditor
        field="name"
        value={props.name}
        onSave={props.onSave}
        placeholder="Votre nom complet"
      />
      <ProfileFieldEditor
        field="username"
        value={props.username}
        onSave={props.onSave}
        placeholder="votre_nom_utilisateur"
      />
      <ProfileFieldEditor
        field="bio"
        value={props.bio}
        onSave={props.onSave}
        placeholder="Parlez-nous de vous..."
      />
    </div>
  )
}
