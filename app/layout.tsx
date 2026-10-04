import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google"
import { JsonLd } from "@/components/seo/json-ld"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

// Direction « Manuel » : serif pour les titres et vignettes, sans pour
// l'interface, mono pour les données. Les variables sont posées sur <html> et
// reprises par `@theme inline` (app/globals.css) en `font-serif` / `font-sans`
// / `font-mono`.
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
})

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
})

// IBM Plex Mono n'existe pas en police variable : graisses explicites.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin", "latin-ext"],
})

const baseUrl = "https://nomaqbanq.ca"

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "NOMAQbanq - Préparation EACMC Partie I",
    template: "%s | NOMAQbanq",
  },
  description:
    "Première plateforme francophone de préparation à l'EACMC Partie I. Plus de 3000 QCM, examens blancs et suivi de progression pour réussir votre examen.",
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
      "Première plateforme francophone de préparation à l'EACMC Partie I. Plus de 3000 QCM pour réussir votre examen.",
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
      "Première plateforme francophone de préparation à l'EACMC Partie I. Plus de 3000 QCM pour réussir votre examen.",
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
}

export const viewport: Viewport = {
  themeColor: "#2563eb",
}

const organizationSchema = {
  "@context": "https://schema.org" as const,
  "@type": "Organization" as const,
  name: "NOMAQbanq",
  url: baseUrl,
  logo: `${baseUrl}/icon.svg`,
  description:
    "Première plateforme francophone de préparation à l'EACMC Partie I. Plus de 3000 QCM, examens blancs et suivi de progression.",
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
    <html
      lang="fr"
      className={`${sourceSerif.variable} ${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://cdn.nomaqbanq.ca" />
      </head>
      <body className="antialiased">
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
