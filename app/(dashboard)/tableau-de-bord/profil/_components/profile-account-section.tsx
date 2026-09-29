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

/** Connexion et sécurité : courriel, mot de passe (formulaire à la demande), Google. */
export const ProfileAccountSection = ({
  methods,
  email,
  googleEnabled,
  profilePath,
}: Props) => {
  const [passwordFormOpen, setPasswordFormOpen] = useState(false)

  return (
    <div className="flex flex-col">
      <ProfileLoginMethods
        methods={methods}
        email={email}
        googleEnabled={googleEnabled}
        profilePath={profilePath}
        onSetPassword={() => setPasswordFormOpen(true)}
        onTogglePassword={() => setPasswordFormOpen((open) => !open)}
        passwordFormOpen={passwordFormOpen}
      />
      {passwordFormOpen && (
        <ProfilePassword
          mode={methods.hasPassword ? "change" : "set"}
          onDone={() => setPasswordFormOpen(false)}
        />
      )}
    </div>
  )
}
