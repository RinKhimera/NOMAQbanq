import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()

const isTypeScript = (name: string) => /\.tsx?$/.test(name)

/** Marche récursive : évite d'ajouter une dépendance de glob pour ces verrous. */
export const walk = (
  dir: string,
  match: (name: string) => boolean = isTypeScript,
): string[] => {
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

export const readSource = (path: string): string =>
  readFileSync(join(ROOT, path), "utf8")

/**
 * Arguments de chaque appel `callee(…)`, parenthèses équilibrées. `callee` est
 * un fragment de regex (`vi\\.mock`, `Promise\\.all(?:Settled)?`). Une
 * parenthèse dans une chaîne littérale fausse le compte : assez juste pour un
 * verrou, pas pour un analyseur.
 */
export const callArguments = (source: string, callee: string): string[] => {
  const calls: string[] = []
  for (const match of source.matchAll(new RegExp(`\\b${callee}\\(`, "g"))) {
    const start = match.index + match[0].length
    let depth = 1
    let i = start
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth++
      else if (source[i] === ")") depth--
      i++
    }
    calls.push(source.slice(start, i - 1))
  }
  return calls
}
