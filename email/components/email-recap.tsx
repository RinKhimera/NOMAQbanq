import { emailTheme } from "../theme"

export type EmailRecapRow = {
  label: string
  value: string
  /** Ligne secondaire sous la valeur (ex. montant en devise locale). */
  sub?: string | null
  /** Chiffre (montant, score) : monospace, comme les chiffres du site. */
  mono?: boolean
}

const { colors, fonts } = emailTheme

// Filet sur la cellule, pas sur la ligne : Outlook bureau ignore la bordure
// d'un `<tr>`.
const cell = {
  borderBottom: `1px solid ${colors.line}`,
  verticalAlign: "top",
  fontFamily: fonts.sans,
  fontSize: "14px",
  lineHeight: "20px",
} as const

export function EmailRecap({
  rows,
  tight = false,
}: {
  rows: EmailRecapRow[]
  /** Marge basse réduite, pour une note grise qui s'y rattache. */
  tight?: boolean
}) {
  return (
    <table
      role="presentation"
      // Sans ce marqueur, le rendu texte brut (corps `Text` envoyé par SES)
      // colle toutes les cellules sur une ligne illisible.
      data-text-format="dataTable"
      cellPadding={0}
      cellSpacing={0}
      width="100%"
      style={{
        borderCollapse: "collapse",
        borderTop: `1px solid ${colors.line}`,
        margin: tight ? "4px 0 12px" : "4px 0 20px",
      }}
    >
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.label}:${row.value}`}>
            <td
              style={{
                ...cell,
                padding: "11px 12px 11px 0",
                width: "42%",
                color: colors.ink3,
              }}
            >
              {row.label}
            </td>
            <td
              style={{
                ...cell,
                padding: "11px 0",
                textAlign: "right",
                wordBreak: "break-word",
                fontWeight: 600,
                color: colors.ink,
              }}
            >
              {row.mono ? (
                <span style={{ fontFamily: fonts.mono }}>{row.value}</span>
              ) : (
                row.value
              )}
              {row.sub ? (
                <>
                  <br />
                  <span
                    style={{
                      fontWeight: 400,
                      fontSize: "13px",
                      color: colors.ink3,
                    }}
                  >
                    {row.sub}
                  </span>
                </>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
