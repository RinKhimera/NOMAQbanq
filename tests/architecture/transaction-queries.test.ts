import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = process.cwd()

const walk = (dir: string): string[] => {
  const out: string[] = []
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) out.push(...walk(path))
    else if (/\.tsx?$/.test(entry.name)) out.push(path)
  }
  return out
}

/** Arguments de `Promise.all(…)` / `Promise.allSettled(…)`, parenthèses équilibrées. */
const parallelCalls = (source: string): string[] => {
  const calls: string[] = []
  for (const match of source.matchAll(/Promise\.all(?:Settled)?\(/g)) {
    let depth = 1
    let i = match.index + match[0].length
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth++
      else if (source[i] === ")") depth--
      i++
    }
    calls.push(source.slice(match.index, i))
  }
  return calls
}

// Une transaction tient UNE connexion, qui n'exécute qu'une requête à la fois :
// pg met les suivantes en file (avertissement de dépréciation) et pg@9 les
// refusera. Les lectures d'une transaction s'enchaînent donc en séquence.
describe("requêtes d'une transaction", () => {
  it("ne sont jamais lancées en parallèle", () => {
    const offenders = ["features", "lib", "app"]
      .flatMap(walk)
      .filter((path) =>
        parallelCalls(readFileSync(join(ROOT, path), "utf8")).some((call) =>
          /\btx\b/.test(call),
        ),
      )
    expect(offenders).toEqual([])
  })
})
