"use client"

import { Shield } from "lucide-react"
import type { ReactNode } from "react"
import type { SessionUser } from "@/lib/session-user"
import { ShellFrame, SideLink } from "./shell-frame"
import { ShellUser } from "./shell-user"

type StudentShellProps = {
  user: SessionUser
  children: ReactNode
}

export const StudentShell = ({ user, children }: StudentShellProps) => (
  <ShellFrame
    zone="student"
    sideFooter={
      <>
        {user.role === "admin" && (
          <SideLink href="/admin" icon={<Shield aria-hidden />}>
            Voir l&apos;administration
          </SideLink>
        )}
        <ShellUser user={user} />
      </>
    }
  >
    {children}
  </ShellFrame>
)
