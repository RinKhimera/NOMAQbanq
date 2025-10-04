import NavBar from "@/components/NavBar"
import Footer from "@/components/layout/Footer"

export default function AuthLayout({
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
