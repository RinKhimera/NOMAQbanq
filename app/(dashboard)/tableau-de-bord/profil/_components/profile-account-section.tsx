"use client"

import { useState } from "react"
import type { LoginMethods } from "@/features/users/dal"
import { ProfileLoginMethods } from "./profile-login-methods"
import { ProfilePassword } from "./profile-password"

type Props = {
  methods: LoginMethods
  email: string
  googleEnabled: boolean
  profilePath: string
}

export const ProfileAccountSection = ({
  methods,
  email,
  googleEnabled,
  profilePath,
}: Props) => {
  // Google-only : le formulaire « définir » n'apparaît qu'à la demande.
  const [showSetPassword, setShowSetPassword] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <ProfileLoginMethods
        methods={methods}
        email={email}
        googleEnabled={googleEnabled}
        profilePath={profilePath}
        onSetPassword={() => setShowSetPassword(true)}
      />
      {methods.hasPassword ? (
        <ProfilePassword mode="change" />
      ) : (
        showSetPassword && <ProfilePassword mode="set" />
      )}
    </div>
  )
}
