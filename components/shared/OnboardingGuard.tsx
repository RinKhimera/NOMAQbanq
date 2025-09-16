"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useCurrentUser } from "@/hooks/useCurrentUser"

// Redirects authenticated users without a username to onboarding page.
// If already onboarded and on the onboarding page, redirect to dashboard.
export const OnboardingGuard = () => {
  const { currentUser, isLoading } = useCurrentUser()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!currentUser) return // not logged in, let other auth logic handle

    const hasUsername = !!currentUser.username
    const onOnboarding = pathname === "/dashboard/onboarding"

    if (!hasUsername && !onOnboarding) {
      router.replace("/dashboard/onboarding")
    } else if (hasUsername && onOnboarding) {
      router.replace("/dashboard")
    }
  }, [currentUser, isLoading, pathname, router])

  return null
}
