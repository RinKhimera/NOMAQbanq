"use client"

import { GraduationCap } from "lucide-react"
import type { ReactNode } from "react"
import type { SessionUser } from "@/lib/session-user"
import { AdminBar } from "./admin-bar"
import { ShellFrame, SideLink } from "./shell-frame"
import { ShellUser } from "./shell-user"

type AdminShellProps = {
  user: SessionUser
  /** Libellé de l'environnement de déploiement, lu côté serveur par le layout. */
  envLabel: string
  children: ReactNode
}

export const AdminShell = ({ user, envLabel, children }: AdminShellProps) => (
  <ShellFrame
    zone="admin"
    banner={<AdminBar envLabel={envLabel} />}
    sideFooter={
      <>
        <SideLink href="/tableau-de-bord" icon={<GraduationCap aria-hidden />}>
          Voir l&apos;espace étudiant
        </SideLink>
        <ShellUser user={user} />
      </>
    }
  >
    {children}
  </ShellFrame>
)
