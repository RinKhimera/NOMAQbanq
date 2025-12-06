import Footer from "@/components/layout/footer"
import NavBar from "@/components/nav-bar"

type MarketingShellProps = {
  children: React.ReactNode
}

export const MarketingShell = ({ children }: MarketingShellProps) => {
  return (
    <>
      <NavBar />
      {children}
      <Footer />
    </>
  )
}
