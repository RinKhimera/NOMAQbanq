import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = process.cwd()
const SOCLE = "components/ui/spinner.tsx"

/** Marche récursive : évite d'ajouter une dépendance de glob pour un seul test. */
const walk = (dir: string, match: (file: string) => boolean): string[] => {
  const out: string[] = []
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
      out.push(...walk(path, match))
    } else if (match(entry.name)) {
      out.push(path)
    }
  }
  return out
}

const tsxFiles = (dir: string) => walk(dir, (name) => name.endsWith(".tsx"))

describe("conventions de chargement", () => {
  it("n'autorise `animate-spin` que dans le composant Spinner", () => {
    const files = [...tsxFiles("app"), ...tsxFiles("components")].filter(
      (file) => relative(SOCLE, file) !== "",
    )

    const offenders = files.filter(
      (file) =>
        file !== SOCLE &&
        readFileSync(join(ROOT, file), "utf8").includes("animate-spin"),
    )

    expect(
      offenders,
      `Utiliser <Spinner> (${SOCLE}) au lieu d'une animation faite main. Voir .claude/rules/loading-ui.md`,
    ).toEqual([])
  })

  it("monte un squelette du socle dans chaque loading.tsx", () => {
    const files = walk("app", (name) => name === "loading.tsx")
    expect(files.length).toBeGreaterThan(0)

    const silent = files.filter(
      (file) => !/Skeleton/.test(readFileSync(join(ROOT, file), "utf8")),
    )

    expect(
      silent,
      "Chaque loading.tsx doit monter un squelette du socle. Voir .claude/rules/loading-ui.md",
    ).toEqual([])
  })
})
