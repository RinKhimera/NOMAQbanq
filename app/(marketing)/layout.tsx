import { MarketingShell } from "@/components/shared/marketing-shell"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MarketingShell>{children}</MarketingShell>
}
