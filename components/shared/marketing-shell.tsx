import { MarketingHeader } from "@/components/marketing-header"
import Footer from "@/components/shared/footer"

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
