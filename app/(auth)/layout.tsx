import { MarketingShell } from "@/components/shared/marketing-shell"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MarketingShell>{children}</MarketingShell>
}
