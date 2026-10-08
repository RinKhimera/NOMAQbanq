import { describe, expect, it } from "vitest"
import { readSource, walk } from "./source-files"

const PALETTE =
  "white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"

const COLOR_UTILITY =
  "bg|text|border(?:-[trblxyse])?|ring|ring-offset|inset-ring|from|via|to|fill|stroke|outline|divide|decoration|placeholder|caret|accent|shadow"

const SHADCN_ALIASES =
  "primary|secondary|muted|card|popover|destructive|input|ring|border|chart-\\d"

// Interdits de `.claude/rules/design-system.md`. Une classe Tailwind se reconnaît
// à sa forme écrite, variantes comprises (`dark:`, `md:hover:`,
// `group-hover/nom:`, variante arbitraire `hover:[&:not(:disabled)]:`).
const RULES = {
  dégradé:
    /(?<![\w-])bg-(?:linear|radial|conic|gradient)(?:-|\b)|bg-clip-text|(?:linear|radial|conic)-gradient\(/,
  "verre dépoli": /backdrop-blur/,
  "échelle ou translation au survol":
    /(?:^|[\s"'`:])(?:[\w-]+-)?hover(?:\/[\w-]+)?:(?:[^\s"'`]+:)*-?(?:scale|translate)-/,
  "import de motion":
    /from\s+["'](?:motion(?:\/[\w-]+)?|framer-motion)["']|import\(\s*["'](?:motion(?:\/[\w-]+)?|framer-motion)["']\s*\)/,
  "couleur de palette brute": new RegExp(
    `(?<![\\w-])(?:${COLOR_UTILITY})-(?:(?:${PALETTE})(?:-\\d{2,3})?(?![\\w-])|\\[#[0-9a-fA-F]{3,8}\\])|(?:var\\(|\\()--color-(?:${PALETTE})-`,
  ),
  // Les alias shadcn n'existent plus dans `@theme` : la classe ne produit aucun
  // style, en silence. Un composant ajouté par `shadcn add` en est plein.
  "alias shadcn retiré": new RegExp(
    `(?<![\\w-])(?:${COLOR_UTILITY})-(?:${SHADCN_ALIASES})(?:-foreground)?(?:\\/\\d+)?(?![\\w-])`,
  ),
  // Une couleur écrite en dur dans une valeur arbitraire (`shadow-[…rgb(…)]`,
  // `bg-[#fff]`) échappe aux noms de palette : elle ne suit pas le thème.
  "couleur en dur dans une valeur arbitraire":
    /-\[[^\]\s"'`]*(?:#[0-9a-fA-F]{3,8}(?![\w-])|(?:rgba?|hsla?|oklch|oklab)\()/,
} as const

type Rule = keyof typeof RULES

// Chaque exception dit pourquoi le motif est légitime à cet endroit précis.
const EXCEPTIONS: Partial<Record<Rule, Record<string, string>>> = {
  "couleur de palette brute": {
    "components/shared/question-image-gallery.tsx":
      "voile posé sur une vignette photo : noir translucide et icône blanche, quel que soit le thème",
  },
}

// `lib/` et `features/` portent aussi des tables de classes (`lib/tone.ts`).
// `email/` écrit ses styles en ligne (hex du thème courriel), mais un dégradé
// ou un import de motion y reste interdit.
const FILES = [
  "app",
  "components",
  "hooks",
  "lib",
  "constants",
  "features",
  "email",
].flatMap((dir) => walk(dir))

const SOURCES = FILES.map((file) => ({
  file,
  lines: readSource(file).split("\n"),
}))

const offenders = (rule: Rule) =>
  SOURCES.filter(({ file }) => !EXCEPTIONS[rule]?.[file]).flatMap(
    ({ file, lines }) =>
      lines.flatMap((line, i) =>
        RULES[rule].test(line) ? [`${file}:${i + 1}  ${line.trim()}`] : [],
      ),
  )

describe("styles interdits dans le code de l'interface", () => {
  it.each(Object.keys(RULES) as Rule[])("%s : aucune occurrence", (rule) => {
    expect(
      offenders(rule),
      `Motif interdit (${rule}). Voir .claude/rules/design-system.md, section « Interdits ».`,
    ).toEqual([])
  })

  it("chaque exception désigne un fichier existant", () => {
    for (const files of Object.values(EXCEPTIONS)) {
      for (const file of Object.keys(files)) expect(FILES).toContain(file)
    }
  })
})

// Le détecteur lui-même : une regex qui ne reconnaît plus rien ferait passer
// le verrou au vert sans rien garder.
describe("détecteur des styles interdits", () => {
  const caught: [Rule, string][] = [
    ["dégradé", `className="bg-linear-to-r from-x to-y"`],
    ["dégradé", `className="dark:bg-gradient-to-br"`],
    ["dégradé", `className="bg-radial"`],
    ["dégradé", `className="bg-clip-text text-transparent"`],
    ["dégradé", `className="bg-[linear-gradient(90deg,red,blue)]"`],
    ["verre dépoli", `className="bg-surface/80 backdrop-blur-sm"`],
    ["échelle ou translation au survol", `className="hover:scale-105"`],
    ["échelle ou translation au survol", `className="md:hover:-translate-y-1"`],
    [
      "échelle ou translation au survol",
      `className="group-hover:translate-x-0.5"`,
    ],
    ["import de motion", `import { motion } from "motion/react"`],
    ["import de motion", `import { m } from 'framer-motion'`],
    ["import de motion", `const M = await import("motion/react")`],
    ["couleur de palette brute", `className="text-gray-500"`],
    ["couleur de palette brute", `className="dark:bg-emerald-950/40"`],
    ["couleur de palette brute", `className="bg-white"`],
    [
      "couleur de palette brute",
      `className="hover:bg-[color-mix(in_oklab,var(--color-gray-50)_50%,white)]"`,
    ],
    [
      "échelle ou translation au survol",
      `className="group-hover/card:scale-105"`,
    ],
    ["échelle ou translation au survol", `className="peer-hover/x:scale-105"`],
    [
      "échelle ou translation au survol",
      `className="hover:[&:not(:disabled)]:scale-105"`,
    ],
    ["couleur de palette brute", `className="text-[#2563eb]"`],
    ["couleur de palette brute", `className="bg-(--color-gray-50)"`],
    ["couleur de palette brute", `className="border-s-red-500"`],
    ["couleur de palette brute", `className="inset-ring-red-500"`],
    ["alias shadcn retiré", `className="bg-muted text-ink"`],
    ["alias shadcn retiré", `className="text-muted-foreground"`],
    ["alias shadcn retiré", `className="focus-visible:ring-ring/50"`],
    ["alias shadcn retiré", `className="border-input bg-popover"`],
    ["alias shadcn retiré", `className="border-border"`],
    ["alias shadcn retiré", `className="data-[state=on]:bg-primary"`],
    [
      "couleur en dur dans une valeur arbitraire",
      `className="shadow-[inset_10px_0_10px_-8px_rgb(0_0_0/0.35)]"`,
    ],
    ["couleur en dur dans une valeur arbitraire", `className="bg-[#fff]"`],
    [
      "couleur en dur dans une valeur arbitraire",
      `className="border-[oklch(0.7_0.1_200)]"`,
    ],
  ]

  const spared: [Rule, string][] = [
    ["dégradé", `className="bg-background bg-dots"`],
    [
      "échelle ou translation au survol",
      `className="translate-x-0 hover:bg-surface-2"`,
    ],
    ["import de motion", `import { cn } from "@/lib/motion-free"`],
    [
      "couleur de palette brute",
      `className="text-ink-3 bg-surface border-line"`,
    ],
    ["couleur de palette brute", `className="text-success-ink bg-danger-soft"`],
    [
      "couleur de palette brute",
      `className="bg-accent text-accent-foreground"`,
    ],
    ["couleur de palette brute", `className="bg-(--shell-offset) text-[15px]"`],
    ["alias shadcn retiré", `<Button variant="destructive" />`],
    [
      "alias shadcn retiré",
      `className="border-line bg-accent-soft ring-accent"`,
    ],
    ["alias shadcn retiré", `className="text-foreground bg-background"`],
    [
      "couleur en dur dans une valeur arbitraire",
      `className="shadow-[inset_10px_0_10px_-8px_var(--edge-shadow)]"`,
    ],
    [
      "couleur en dur dans une valeur arbitraire",
      `className="max-w-[calc(100vw-40px)] text-[15px] grid-cols-[minmax(0,360px)_1fr]"`,
    ],
  ]

  it.each(caught)("reconnaît un %s : %s", (rule, line) => {
    expect(RULES[rule].test(line)).toBe(true)
  })

  it.each(spared)("épargne un usage permis (%s) : %s", (rule, line) => {
    expect(RULES[rule].test(line)).toBe(false)
  })
})
