import type { ReactNode } from "react"
import { emailTheme } from "../theme"

const { colors, fonts } = emailTheme

export function EmailSteps({ items }: { items: ReactNode[] }) {
  return (
    <table
      role="presentation"
      // Une étape par ligne dans le texte brut, numéro compris.
      data-text-format="dataTable"
      cellPadding={0}
      cellSpacing={0}
      width="100%"
      style={{ borderCollapse: "collapse", margin: "0 0 20px" }}
    >
      <tbody>
        {items.map((item, index) => {
          const number = String(index + 1).padStart(2, "0")
          return (
            <tr key={number}>
              <td
                style={{
                  width: "28px",
                  padding: "6px 0",
                  verticalAlign: "top",
                  fontFamily: fonts.mono,
                  fontSize: "13px",
                  lineHeight: "24px",
                  color: colors.ink3,
                }}
              >
                {number}
              </td>
              <td
                style={{
                  padding: "6px 0",
                  verticalAlign: "top",
                  fontFamily: fonts.sans,
                  fontSize: "16px",
                  lineHeight: "24px",
                  color: colors.ink2,
                }}
              >
                {item}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
