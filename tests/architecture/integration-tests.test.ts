import { describe, expect, it } from "vitest"
import { callArguments, readSource, walk } from "./source-files"

const files = walk("tests/integration", (name) =>
  name.endsWith(".test.ts"),
).map((path) => ({ path, source: readSource(path) }))

const offenders = (predicate: (source: string) => boolean) =>
  files.filter(({ source }) => predicate(source)).map(({ path }) => path)

// Conventions de `.claude/rules/testing.md`, section « Tests d'intégration ».
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
        callArguments(s, "vi\\.mock").some(
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
        callArguments(s, "afterAll").some((body) =>
          /\.delete\(|\bdelete\s+from\b|^\s*\w*clean\w*\s*$/i.test(body),
        ),
      ),
    ).toEqual([])
  })
})
