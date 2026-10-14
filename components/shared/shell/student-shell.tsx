"use client"

import { Shield } from "lucide-react"
import type { ReactNode } from "react"
import type { ShellAccess } from "@/features/payments/dal"
import type { SessionUser } from "@/lib/session-user"
import { ShellAccessLines } from "./shell-access"
import { ShellFrame, SideLink } from "./shell-frame"
import { ShellUser } from "./shell-user"

type StudentShellProps = {
  user: SessionUser
  /** `null` quand le layout ne l'a pas lu (admin). */
  access: ShellAccess | null
  children: ReactNode
}

export const StudentShell = ({ user, access, children }: StudentShellProps) => (
  <ShellFrame
    zone="student"
    sideFooter={(onReselect) => (
      <>
        {/* Un admin n'a besoin d'aucun accès : « Non actif » serait faux. */}
        {user.role !== "admin" && access && (
          <ShellAccessLines access={access} onReselect={onReselect} />
        )}
        {user.role === "admin" && (
          <SideLink href="/admin" icon={<Shield aria-hidden />}>
            Voir l&apos;administration
          </SideLink>
        )}
        <ShellUser user={user} />
      </>
    )}
  >
    {children}
  </ShellFrame>
)
