import { emailTheme } from "../theme"

export type EmailRecapRow = {
  label: string
  value: string
  /** Ligne secondaire sous la valeur (ex. montant en devise locale). */
  sub?: string | null
}

const { colors, fontFamily, radius } = emailTheme

export function EmailRecap({ rows }: { rows: EmailRecapRow[] }) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      width="100%"
      style={{
        borderCollapse: "separate",
        border: `1px solid ${colors.border}`,
        borderRadius: radius.table,
        margin: "4px 0 18px",
        fontFamily,
      }}
    >
      <tbody>
        {rows.map((row, index) => {
          const cell = {
            padding: "10px 14px",
            fontSize: "14px",
            lineHeight: "1.45",
            verticalAlign: "top" as const,
            borderTop: index === 0 ? "none" : `1px solid ${colors.divider}`,
          }
          return (
            <tr key={`${row.label}:${row.value}`}>
              <td style={{ ...cell, color: colors.muted, width: "38%" }}>
                {row.label}
              </td>
              <td style={{ ...cell, color: colors.text, fontWeight: 600 }}>
                {row.value}
                {row.sub ? (
                  <span
                    style={{
                      display: "block",
                      fontWeight: 400,
                      fontSize: "12.5px",
                      color: colors.muted,
                    }}
                  >
                    {row.sub}
                  </span>
                ) : null}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
