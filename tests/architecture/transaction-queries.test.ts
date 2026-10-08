import { describe, expect, it } from "vitest"
import { callArguments, readSource, walk } from "./source-files"

// Une transaction tient UNE connexion, qui n'exécute qu'une requête à la fois :
// pg met les suivantes en file (avertissement de dépréciation) et pg@9 les
// refusera. Les lectures d'une transaction s'enchaînent donc en séquence.
describe("requêtes d'une transaction", () => {
  it("ne sont jamais lancées en parallèle", () => {
    const offenders = ["features", "lib", "app"]
      .flatMap((dir) => walk(dir))
      .filter((path) =>
        callArguments(readSource(path), "Promise\\.all(?:Settled)?").some(
          (call) => /\btx\b/.test(call),
        ),
      )
    expect(offenders).toEqual([])
  })
})
