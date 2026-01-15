import Footer from "@/components/layout/footer"
import { MarketingHeader } from "@/components/marketing-header"

type MarketingShellProps = {
  children: React.ReactNode
}

export const MarketingShell = ({ children }: MarketingShellProps) => {
  return (
    <>
      <MarketingHeader />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  )
}
