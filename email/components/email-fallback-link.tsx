import { emailTheme } from "../theme"

const { colors, fonts } = emailTheme

export function EmailFallbackLink({ href }: { href: string }) {
  return (
    <p
      style={{
        margin: "0 0 16px",
        fontFamily: fonts.sans,
        fontSize: "13px",
        lineHeight: "20px",
        color: colors.ink3,
      }}
    >
      {"Ou copiez ce lien dans votre navigateur :"}
      <br />
      <a
        href={href}
        target="_blank"
        style={{
          fontFamily: fonts.mono,
          fontSize: "12px",
          color: colors.accent,
          wordBreak: "break-all",
          overflowWrap: "anywhere",
        }}
      >
        {href}
      </a>
    </p>
  )
}
