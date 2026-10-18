import { describe, expect, it } from "vitest"
import { readSource, walk } from "./source-files"

// Le CMC a renommé l'« EACMC, partie I » en « EACMC » (entrée EACMC de
// `CONTEXT.md`). L'ancien nom ne survit qu'en rappel, « EACMC (anciennement
// Partie I) », et dans le guide qui explique le renommage. « partie 1 » reste
// pour la recherche, une fois par page clé : dans la description (sa présence
// y est verrouillée par `tests/marketing/metadata.test.ts`) et dans les
// `keywords` du layout.
const GUIDE = "app/(marketing)/eacmc-partie-1/"

const PARTIE_1_ALLOWED: Record<string, number> = {
  "app/layout.tsx": 1,
  "app/(marketing)/page.tsx": 1,
  "app/(marketing)/tarifs/page.tsx": 1,
  "app/(marketing)/evaluation/page.tsx": 1,
  "app/(marketing)/domaines/page.tsx": 1,
  "app/(marketing)/domaines/[slug]/page.tsx": 1,
}

// Le source se lit en entier, chaque écriture d'une espace ramenée à une espace
// simple : un nom coupé par Prettier ou une insécable écrite en jeton
// (`{NBSP}`, `&nbsp;`, échappement) reste reconnu.
const SPACE_TOKENS =
  /\$?\{\s*NBSP\s*\}|\{\s*" "\s*\}|"\s*\+\s*NBSP\s*\+\s*"|&nbsp;|&#160;|&#xa0;|\\(?:u00a0)/gi
const REMINDER = /anciennement Partie I\b/g
const PARTIE_I = /partie I\b/gi
const PARTIE_1 = /partie 1\b/gi

const scrub = (source: string) =>
  source.replace(SPACE_TOKENS, " ").replace(/\s+/g, " ").replace(REMINDER, "")

const SOURCES = [
  "app",
  "components",
  "hooks",
  "lib",
  "constants",
  "features",
  "email",
  "scripts",
]
  .flatMap((dir) => walk(dir))
  .filter((file) => !file.startsWith(GUIDE))
  .map((file) => ({ file, text: scrub(readSource(file)) }))

describe("nom de l'examen", () => {
  it("le verrou lit les sources qui portaient l'ancien nom", () => {
    const files = SOURCES.map(({ file }) => file)
    expect(files).toContain("components/shared/footer.tsx")
    expect(files).toContain("scripts/dispute-evidence.ts")
    for (const file of Object.keys(PARTIE_1_ALLOWED))
      expect(files).toContain(file)
  })

  it("« Partie I » ne s'écrit qu'en rappel ou dans le guide", () => {
    const offenders = SOURCES.flatMap(({ file, text }) =>
      [...text.matchAll(PARTIE_I)].map(
        (m) =>
          `${file} : …${text.slice(Math.max(0, m.index - 40), m.index + 30)}…`,
      ),
    )
    expect(
      offenders,
      "Écrire « EACMC » (glossaire CONTEXT.md, règle « Titres » de seo.md).",
    ).toEqual([])
  })

  it("« partie 1 » ne s'écrit qu'une fois par page clé", () => {
    const counts = Object.fromEntries(
      SOURCES.map(
        ({ file, text }) => [file, text.match(PARTIE_1)?.length ?? 0] as const,
      ).filter(([, count]) => count > 0),
    )
    expect(counts).toEqual(PARTIE_1_ALLOWED)
  })

  it("le détecteur reconnaît l'ancien nom sous ses graphies", () => {
    const nbsp = String.fromCharCode(0xa0)
    for (const line of [
      "l'EACMC Partie I.",
      `l'EACMC Partie${nbsp}I`,
      "l'EACMC Partie" + "\\" + "u00a0I",
      "l&apos;EACMC Partie&nbsp;I.",
      "l'EACMC Partie&#160;I",
      "`EACMC Partie${NBSP}I · QCM`",
      "EACMC Partie{NBSP}I",
      'EACMC Partie{" "}I',
      '"EACMC Partie" + NBSP + "I"',
      "préparation à l'EACMC\n              Partie I.",
      "EACMC Partie I, (anciennement Partie I)",
    ])
      expect(scrub(line)).toMatch(PARTIE_I)
    expect(
      scrub("l'EACMC (anciennement Partie${NBSP}I) ?").match(PARTIE_I),
    ).toBeNull()
    expect(scrub("une partie importante").match(PARTIE_I)).toBeNull()
    expect(scrub("l'EACMC partie\n 1 :").match(PARTIE_1)).not.toBeNull()
  })
})
