import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import NavBar from "@/components/NavBar"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import { LanguageProvider } from "@/contexts/LanguageContext"
import ConvexClientProvider from "@/providers/convex-client-provider"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "NOMAQbank - Préparation EACMC Partie I",
  description:
    "Première plateforme francophone de préparation à l'EACMC Partie I. Plus de 5000 QCM pour réussir votre examen.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ConvexClientProvider>
              <NavBar />
              {children}
            </ConvexClientProvider>
          </ThemeProvider>
        </LanguageProvider>
        <Toaster richColors />
      </body>
    </html>
  )
}
