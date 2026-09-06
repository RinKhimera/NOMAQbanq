import { Text } from "@react-email/components"
import type { ReactNode } from "react"
import { emailTheme } from "../theme"

export function EmailParagraph({
  muted = false,
  children,
}: {
  muted?: boolean
  children: ReactNode
}) {
  return (
    <Text
      style={{
        fontFamily: emailTheme.fontFamily,
        fontSize: muted ? "13px" : "15px",
        lineHeight: "1.55",
        color: muted ? emailTheme.colors.muted : emailTheme.colors.text,
        margin: "0 0 16px",
      }}
    >
      {children}
    </Text>
  )
}
