"use client"

import { DashboardShell } from "@/components/shared/dashboard-shell"
import { OnboardingGuard } from "@/components/shared/onboarding-guard"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <OnboardingGuard />
      <DashboardShell variant="user">{children}</DashboardShell>
    </>
  )
}
