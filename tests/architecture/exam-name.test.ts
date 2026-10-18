import { describe, expect, it } from "vitest"
import { readSource, walk } from "./source-files"

// Le CMC a renommé l'« EACMC, partie I » en « EACMC » (entrée EACMC de
// `CONTEXT.md`). L'ancien nom ne survit qu'en rappel, « EACMC (anciennement
// Partie I) », et dans le guide qui explique le renommage. « partie 1 », gardé
// pour la recherche dans quelques descriptions, est verrouillé par
// `tests/marketing/metadata.test.ts`.
const OLD_NAME = /partie(?:\s|&nbsp;|\$\{NBSP\})I\b/i
const REMINDER = /anciennement(?:\s|&nbsp;|\$\{NBSP\})Partie/
const GUIDE = "app/(marketing)/eacmc-partie-1/"

const FILES = ["app", "components", "lib", "constants", "features", "email"]
  .flatMap((dir) => walk(dir))
  .filter((file) => !file.startsWith(GUIDE))

const offenders = FILES.flatMap((file) =>
  readSource(file)
    .split("\n")
    .flatMap((line, i) =>
      OLD_NAME.test(line) && !REMINDER.test(line)
        ? [`${file}:${i + 1}  ${line.trim()}`]
        : [],
    ),
)

describe("nom de l'examen", () => {
  it("l'ancien nom « Partie I » ne s'écrit qu'en rappel ou dans le guide", () => {
    expect(
      offenders,
      "Écrire « EACMC » (glossaire CONTEXT.md, règle « Titres » de seo.md).",
    ).toEqual([])
  })

  it("le détecteur reconnaît l'ancien nom sous ses graphies", () => {
    for (const line of [
      "l'EACMC Partie I.",
      "l'EACMC Partie\u00a0I",
      "l&apos;EACMC Partie&nbsp;I.",
      "`EACMC Partie${NBSP}I · QCM`",
    ])
      expect(OLD_NAME.test(line) && !REMINDER.test(line)).toBe(true)
    expect(REMINDER.test("l'EACMC (anciennement Partie${NBSP}I) ?")).toBe(true)
    expect(OLD_NAME.test("une partie Importante")).toBe(false)
  })
})
