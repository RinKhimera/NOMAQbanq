import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { DOMAINS, domainBySlug } from "@/constants/domains"

export const alt = "QCM pour l'EACMC Partie I, par domaine médical"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Comme la page : une image par domaine, générée au build ; un slug hors
// liste est un 404, jamais un rendu à la demande.
export const dynamicParams = false

export function generateStaticParams() {
  return DOMAINS.map((d) => ({ slug: d.slug }))
}

// Valeurs des jetons clairs de `app/globals.css` : Satori ne lit pas les
// variables CSS.
const TOKENS = {
  bg: "#fbfbfa",
  ink: "#0f172a",
  ink3: "#5b6678",
  line: "#e6e4df",
  accentInk: "#1d4ed8",
  patternDot: "#c9d2df",
}

const NBSP = "\u00a0"

const asset = (path: string) => readFile(join(process.cwd(), path))

const [serif, sans, mono, logoMark] = await Promise.all([
  asset("assets/fonts/source-serif-4-latin-600-normal.woff"),
  asset("assets/fonts/ibm-plex-sans-latin-500-normal.woff"),
  asset("assets/fonts/ibm-plex-mono-latin-500-normal.woff"),
  asset("public/icons/logo-mark-dark.svg"),
])

const svgDataUri = (svg: string | Buffer) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`

// Trame de points de la vitrine (pas de 22 px, point de 1 px), dessinée en
// motif SVG : Satori n'a pas d'équivalent au `bg-dots` de Tailwind.
const DOTS = svgDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="630"><defs><pattern id="d" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.3" fill="${TOKENS.patternDot}"/></pattern></defs><rect width="100%" height="100%" fill="url(#d)"/></svg>`,
)

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const domain = domainBySlug((await params).slug)
  const name = domain?.name ?? "Domaines médicaux"

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: TOKENS.bg,
        color: TOKENS.ink,
        fontFamily: "Plex Sans",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendu Satori, pas une page */}
      <img
        src={DOTS}
        width={560}
        height={630}
        alt=""
        style={{ position: "absolute", top: 0, right: 0 }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendu Satori, pas une page */}
          <img src={svgDataUri(logoMark)} width={56} height={56} alt="" />
          <span
            style={{
              fontFamily: "Source Serif",
              fontSize: 36,
              letterSpacing: "-0.01em",
            }}
          >
            NOMAQbanq
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            maxWidth: 900,
          }}
        >
          <span
            style={{
              fontFamily: "Plex Mono",
              fontSize: 26,
              color: TOKENS.accentInk,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {`EACMC Partie${NBSP}I · QCM`}
          </span>
          <span
            style={{
              fontFamily: "Source Serif",
              fontSize: name.length > 24 ? 76 : 96,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            {name}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: `1px solid ${TOKENS.line}`,
            paddingTop: 24,
            fontSize: 24,
            color: TOKENS.ink3,
          }}
        >
          <span>Questions rattachées aux objectifs du CMC</span>
          <span style={{ fontFamily: "Plex Mono" }}>nomaqbanq.ca</span>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Source Serif", data: serif, weight: 600, style: "normal" },
        { name: "Plex Sans", data: sans, weight: 500, style: "normal" },
        { name: "Plex Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  )
}
