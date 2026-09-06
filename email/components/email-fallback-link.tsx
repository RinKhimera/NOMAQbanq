import { Link, Text } from "@react-email/components"
import { emailTheme } from "../theme"

export function EmailFallbackLink({ href }: { href: string }) {
  return (
    <Text
      style={{
        fontFamily: emailTheme.fontFamily,
        fontSize: "13px",
        lineHeight: "1.5",
        color: emailTheme.colors.muted,
        margin: "12px 0 16px",
      }}
    >
      Ou copiez ce lien dans votre navigateur :{" "}
      <Link
        href={href}
        style={{ color: emailTheme.colors.accent, wordBreak: "break-all" }}
      >
        {href}
      </Link>
    </Text>
  )
}
