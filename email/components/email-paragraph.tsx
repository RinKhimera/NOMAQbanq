import type { CSSProperties, ReactNode } from "react"
import { emailTheme } from "../theme"

const { colors, fonts } = emailTheme

export function EmailParagraph({
  muted = false,
  style,
  children,
}: {
  muted?: boolean
  /** Ajustement local de marge ou de couleur. */
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <p
      style={{
        ...(muted
          ? {
              margin: "0 0 12px",
              fontFamily: fonts.sans,
              fontSize: "13px",
              lineHeight: "20px",
              color: colors.ink3,
            }
          : {
              margin: "0 0 16px",
              fontFamily: fonts.sans,
              fontSize: "16px",
              lineHeight: "26px",
              color: colors.ink2,
            }),
        ...style,
      }}
    >
      {children}
    </p>
  )
}
