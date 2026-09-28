import { getCachedMarketingStats } from "@/features/marketing/cached"
import { AuthShell } from "./_components/auth-shell"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const stats = await getCachedMarketingStats()
  return <AuthShell stats={stats}>{children}</AuthShell>
}
