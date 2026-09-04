import type { ReactNode } from "react"
import { emailTheme } from "../theme"

const TONES = {
  info: { background: "#eef4ff", rule: emailTheme.colors.accent },
  warning: { background: "#fef3e2", rule: emailTheme.colors.warning },
  success: { background: "#e6f7f0", rule: emailTheme.colors.success },
} as const

export type EmailNoticeVariant = keyof typeof TONES

export function EmailNotice({
  variant,
  children,
}: {
  variant: EmailNoticeVariant
  children: ReactNode
}) {
  const tone = TONES[variant]
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      width="100%"
      style={{ borderCollapse: "separate", margin: "0 0 16px" }}
    >
      <tbody>
        <tr>
          <td
            data-variant={variant}
            style={{
              backgroundColor: tone.background,
              borderLeft: `3px solid ${tone.rule}`,
              borderRadius: "6px",
              padding: "12px 14px",
              fontFamily: emailTheme.fontFamily,
              fontSize: "13.5px",
              lineHeight: "1.5",
              color: emailTheme.colors.text,
            }}
          >
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  )
}
