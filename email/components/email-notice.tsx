import type { ReactNode } from "react"
import { emailTheme } from "../theme"

export type EmailNoticeVariant = keyof typeof emailTheme.tones

export function EmailNotice({
  variant,
  children,
}: {
  variant: EmailNoticeVariant
  children: ReactNode
}) {
  const tone = emailTheme.tones[variant]
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      width="100%"
      style={{ borderCollapse: "separate", margin: "0 0 20px" }}
    >
      <tbody>
        <tr>
          <td
            data-variant={variant}
            style={{
              backgroundColor: tone.background,
              border: `1px solid ${tone.line}`,
              borderRadius: emailTheme.radius.control,
              padding: "12px 14px",
              fontFamily: emailTheme.fonts.sans,
              fontSize: "14px",
              lineHeight: "22px",
              color: emailTheme.colors.ink,
            }}
          >
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
