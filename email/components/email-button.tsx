import { Button } from "@react-email/components"
import type { ReactNode } from "react"
import { emailTheme } from "../theme"

export function EmailButton({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Button
      href={href}
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        textAlign: "center",
        backgroundColor: emailTheme.colors.accent,
        color: "#ffffff",
        fontFamily: emailTheme.fontFamily,
        fontSize: "15px",
        fontWeight: 700,
        padding: "13px 24px",
        borderRadius: emailTheme.radius.button,
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  )
}
