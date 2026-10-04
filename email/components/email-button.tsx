import type { ReactNode } from "react"
import { emailTheme } from "../theme"

const { colors, fonts, radius } = emailTheme

// Largeur naturelle ; la règle `.nq-btn` du layout l'étend sous 480 px. Le
// lien en bloc rend tout l'aplat cliquable ; Outlook bureau (moteur Word)
// ignore le padding d'un lien et lit `mso-padding-alt` sur la cellule.
export function EmailButton({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <table
      role="presentation"
      className="nq-btn"
      cellPadding={0}
      cellSpacing={0}
      style={{ borderCollapse: "separate", margin: "8px 0 16px" }}
    >
      <tbody>
        <tr>
          <td
            style={{
              backgroundColor: colors.accent,
              borderRadius: radius.control,
              textAlign: "center",
              msoPaddingAlt: "12px 22px",
            }}
          >
            <a
              href={href}
              target="_blank"
              style={{
                display: "block",
                padding: "12px 22px",
                fontFamily: fonts.sans,
                fontSize: "16px",
                fontWeight: 600,
                lineHeight: "20px",
                color: "#ffffff",
                textDecoration: "none",
              }}
            >
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
