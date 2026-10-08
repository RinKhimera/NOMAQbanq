import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const DIR = "tests/integration"

const files = readdirSync(join(process.cwd(), DIR))
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => ({
    path: `${DIR}/${name}`,
    source: readFileSync(join(process.cwd(), DIR, name), "utf8"),
  }))

/** Corps d'un appel `name(…)`, parenthèses équilibrées. */
const callBodies = (source: string, name: string): string[] => {
  const bodies: string[] = []
  for (const match of source.matchAll(new RegExp(`\\b${name}\\(`, "g"))) {
    const start = match.index + match[0].length
    let depth = 1
    let i = start
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth++
      else if (source[i] === ")") depth--
      i++
    }
    bodies.push(source.slice(start, i - 1))
  }
  return bodies
}

const offenders = (predicate: (source: string) => boolean) =>
  files.filter(({ source }) => predicate(source)).map(({ path }) => path)

// Conventions de `.claude/rules/data-layer.md`, section « Tests d'intégration ».
describe("conventions des tests d'intégration", () => {
  it("trouve les fichiers d'intégration", () => {
    expect(files.length).toBeGreaterThan(0)
  })

  // Hors condition `react-server`, `cache` de React est déjà l'identité : le
  // mock ne fait rien, mais il se recopie de fichier en fichier.
  it("ne mocke pas react", () => {
    expect(offenders((s) => /vi\.mock\(\s*["']react["']/.test(s))).toEqual([])
  })

  // Un faux partiel rend `undefined` pour un verbe absent : l'erreur tombe dans
  // un catch et aucun test ne rougit.
  it.each([
    ["@/email", "fake-mailer"],
    ["@/lib/stripe", "fake-stripe"],
  ])("ne remplace %s que par le faux complet (%s)", (module, fake) => {
    const mock = new RegExp(`vi\\.mock\\(\\s*["']${module}["']`)
    expect(
      offenders((s) =>
        callBodies(s, "vi\\.mock").some(
          (body) => mock.test(`vi.mock(${body}`) && !body.includes(fake),
        ),
      ),
    ).toEqual([])
  })

  // Chaque fichier part d'une base neuve, recréée au fichier suivant : un
  // nettoyage de fin de fichier est du code mort qui se recopie.
  it("ne nettoie pas la base en fin de fichier", () => {
    expect(
      offenders((s) =>
        callBodies(s, "afterAll").some((body) =>
          /\.delete\(|delete\s+from|^\s*\w*clean\w*\s*$/i.test(body),
        ),
      ),
    ).toEqual([])
  })
})
