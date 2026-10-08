import { describe, expect, it } from "vitest"
import { readSource, walk } from "./source-files"

const SOCLE = "components/ui/spinner.tsx"

const tsxFiles = (dir: string) => walk(dir, (name) => name.endsWith(".tsx"))

describe("conventions de chargement", () => {
  it("n'autorise `animate-spin` que dans le composant Spinner", () => {
    const offenders = [...tsxFiles("app"), ...tsxFiles("components")].filter(
      (file) => file !== SOCLE && readSource(file).includes("animate-spin"),
    )

    expect(
      offenders,
      `Utiliser <Spinner> (${SOCLE}) au lieu d'une animation faite main. Voir .claude/rules/loading-ui.md`,
    ).toEqual([])
  })

  it("ne définit aucune animation de chargement concurrente en CSS", () => {
    // Le grep sur `animate-spin` ne voit que le JSX : une classe utilitaire
    // définie dans la feuille globale lui échapperait et refragmenterait le
    // socle.
    const css = readSource("app/globals.css")
    const offenders = ["loading-shimmer", "skeleton-pulse", "spinner"].filter(
      (name) => css.includes(`.${name}`),
    )

    expect(
      offenders,
      "Les états de chargement passent par components/ui/, pas par des classes CSS globales. Voir .claude/rules/loading-ui.md",
    ).toEqual([])
  })

  it("monte un squelette du socle dans chaque loading.tsx", () => {
    const files = walk("app", (name) => name === "loading.tsx")
    expect(files.length).toBeGreaterThan(0)

    const silent = files.filter((file) => !/Skeleton/.test(readSource(file)))

    expect(
      silent,
      "Chaque loading.tsx doit monter un squelette du socle. Voir .claude/rules/loading-ui.md",
    ).toEqual([])
  })
})
