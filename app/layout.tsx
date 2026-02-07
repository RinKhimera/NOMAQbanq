import type { Metadata } from "next"
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { JsonLd } from "@/components/seo/json-ld"
import { Toaster } from "@/components/ui/sonner"
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

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
})

const baseUrl = "https://nomaqbanq.ca"

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "NOMAQbanq - Préparation EACMC Partie I",
    template: "%s | NOMAQbanq",
  },
  description:
    "Première plateforme francophone de préparation à l'EACMC Partie I. Plus de 5000 QCM, examens blancs et suivi de progression pour réussir votre examen.",
  keywords: [
    "EACMC",
    "EACMC Partie 1",
    "préparation EACMC",
    "QCM médical",
    "examen médical Canada",
    "diplômé médecin international",
    "DMI Canada",
    "banque questions médicales",
    "CMC objectifs",
    "résidences Canada",
  ],
  authors: [{ name: "NOMAQbanq" }],
  creator: "NOMAQbanq",
  publisher: "NOMAQbanq",
  openGraph: {
    type: "website",
    locale: "fr_CA",
    url: baseUrl,
    siteName: "NOMAQbanq",
    title: "NOMAQbanq - Préparation EACMC Partie I",
    description:
      "Première plateforme francophone de préparation à l'EACMC Partie I. Plus de 5000 QCM pour réussir votre examen.",
    images: [
      {
        url: "/images/home-image.jpg",
        width: 1200,
        height: 630,
        alt: "NOMAQbanq - Plateforme de préparation EACMC",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NOMAQbanq - Préparation EACMC Partie I",
    description:
      "Première plateforme francophone de préparation à l'EACMC Partie I. Plus de 5000 QCM pour réussir votre examen.",
    images: ["/images/home-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: baseUrl,
    languages: {
      "fr-CA": baseUrl,
      "x-default": baseUrl,
    },
  },
  themeColor: "#2563eb",
}

const organizationSchema = {
  "@context": "https://schema.org" as const,
  "@type": "Organization" as const,
  name: "NOMAQbanq",
  url: baseUrl,
  logo: `${baseUrl}/icon.svg`,
  description:
    "Première plateforme francophone de préparation à l'EACMC Partie I. Plus de 5000 QCM, examens blancs et suivi de progression.",
  contactPoint: {
    "@type": "ContactPoint",
    email: "nomaqbanq@outlook.com",
    telephone: "+1-438-875-0746",
    contactType: "customer service",
    availableLanguage: "French",
  },
}

const websiteSchema = {
  "@context": "https://schema.org" as const,
  "@type": "WebSite" as const,
  name: "NOMAQbanq",
  url: baseUrl,
  description:
    "Plateforme francophone de préparation à l'EACMC Partie I avec QCM et examens blancs.",
  inLanguage: "fr-CA",
  potentialAction: {
    "@type": "SearchAction",
    target: `${baseUrl}/faq?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable} antialiased`}
      >
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ThemeProvider>

        <Toaster richColors />
      </body>
    </html>
  )
}
