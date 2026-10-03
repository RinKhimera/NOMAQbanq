import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

/** Marche récursive : évite d'ajouter une dépendance de glob pour un seul test. */
const walk = (dir: string): string[] => {
  const out: string[] = []
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
      out.push(...walk(path))
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(path)
    }
  }
  return out
}

const PALETTE =
  "white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose"

// Interdits de `.claude/rules/design-system.md`. Une classe Tailwind se reconnaît
// à sa forme écrite, variantes comprises (`dark:`, `md:hover:`, `group-hover:`).
const RULES = {
  dégradé:
    /(?<![\w-])bg-(?:linear|radial|conic|gradient)(?:-|\b)|bg-clip-text|(?:linear|radial|conic)-gradient\(/,
  "verre dépoli": /backdrop-blur/,
  "échelle ou translation au survol":
    /hover:(?:[\w[\]=&>*-]+:)*-?(?:scale|translate)-/,
  "import de motion":
    /from\s+["'](?:motion(?:\/[\w-]+)?|framer-motion)["']|import\(\s*["'](?:motion(?:\/[\w-]+)?|framer-motion)["']\s*\)/,
  "couleur de palette brute": new RegExp(
    `(?<![\\w-])(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|from|via|to|fill|stroke|outline|divide|decoration|placeholder|caret|accent|shadow)-(?:${PALETTE})(?:-\\d{2,3})?(?![\\w-])|var\\(--color-(?:${PALETTE})-`,
  ),
} as const

type Rule = keyof typeof RULES

// Chaque exception dit pourquoi le motif est légitime à cet endroit précis.
const EXCEPTIONS: Partial<Record<Rule, Record<string, string>>> = {
  "couleur de palette brute": {
    "app/global-error.tsx":
      "remplace le layout racine : la feuille globale et ses jetons n'y sont pas garantis",
    "components/shared/question-image-gallery.tsx":
      "visionneuse d'images : fond noir et texte blanc quel que soit le thème",
  },
}

const FILES = [...walk("app"), ...walk("components")]

const offenders = (rule: Rule) =>
  FILES.filter((file) => !EXCEPTIONS[rule]?.[file]).flatMap((file) =>
    readFileSync(join(ROOT, file), "utf8")
      .split("\n")
      .flatMap((line, i) =>
        RULES[rule].test(line) ? [`${file}:${i + 1}  ${line.trim()}`] : [],
      ),
  )

describe("styles interdits dans app/ et components/", () => {
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
  ]

  it.each(caught)("reconnaît un %s : %s", (rule, line) => {
    expect(RULES[rule].test(line)).toBe(true)
  })

  it.each(spared)("épargne un usage permis (%s) : %s", (rule, line) => {
    expect(RULES[rule].test(line)).toBe(false)
  })
})
