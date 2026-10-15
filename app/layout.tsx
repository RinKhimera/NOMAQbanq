import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google"
import { JsonLd } from "@/components/seo/json-ld"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import {
  SITE_DESCRIPTION,
  SITE_OPEN_GRAPH,
  SITE_URL,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo"
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NOMAQbanq - Préparation EACMC Partie I",
    template: "%s | NOMAQbanq",
  },
  description: SITE_DESCRIPTION,
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
    ...SITE_OPEN_GRAPH,
    url: SITE_URL,
    title: "NOMAQbanq - Préparation EACMC Partie I",
    description: SITE_DESCRIPTION,
  },
  // Ni titre, ni description, ni image : Next les reprend de l'Open Graph de
  // chaque page. Les fixer ici servirait ceux de l'accueil sur tout le site.
  twitter: { card: "summary_large_image" },
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
    canonical: SITE_URL,
    languages: {
      "fr-CA": SITE_URL,
      "x-default": SITE_URL,
    },
  },
}

export const viewport: Viewport = {
  themeColor: "#2563eb",
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
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
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
