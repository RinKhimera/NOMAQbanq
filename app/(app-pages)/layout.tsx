import Footer from "@/components/layout/footer"
import NavBar from "@/components/nav-bar"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <NavBar />
      {children}
      <Footer />
    </>
  )
}
