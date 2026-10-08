import { describe, expect, it } from "vitest"
import { callArguments, readSource, walk } from "./source-files"

// La config (`mockReset`, `restoreMocks`, `unstubEnvs`, `unstubGlobals`) et
// `vitest.setup.common.ts` (vrais timers) remettent l'état entre deux tests :
// un reset recopié dans un fichier est du bruit, et finit par masquer celui
// qui manque vraiment.
const testFiles = walk("tests", (name) => /\.test\.tsx?$/.test(name)).map(
  (path) => ({ path, source: readSource(path) }),
)

const offenders = (pattern: RegExp, allowed: string[] = []) =>
  testFiles
    .filter(
      ({ path, source }) => pattern.test(source) && !allowed.includes(path),
    )
    .map(({ path }) => path)

describe("hygiène des tests", () => {
  it("aucun reset global recopié : la config les applique déjà", () => {
    expect(
      offenders(
        /vi\.(clearAllMocks|resetAllMocks|restoreAllMocks|unstubAllEnvs|unstubAllGlobals)\(/,
      ),
    ).toEqual([])
  })

  it("aucun mockReset() manuel : `mockReset: true` le fait avant chaque test", () => {
    // Le projet `integration` garde ses mocks d'un test à l'autre (`beforeAll`).
    const integration = testFiles
      .map(({ path }) => path)
      .filter((path) => path.startsWith("tests/integration/"))
    expect(offenders(/\.mockReset\(\)/, integration)).toEqual([])
  })

  it("aucune implémentation par défaut posée au chargement : `mockReset` l'efface", () => {
    // `vi.fn(impl)` survit au reset (il revient à `impl`) ; un
    // `vi.fn().mockResolvedValue(…)` d'une factory ou d'une constante de module
    // rend `undefined` dès le premier test, sans qu'aucun test ne rougisse.
    const loadTimeDefault =
      /vi\.fn(<[^>]*>)?\(\)\s*\.mock(Implementation|ReturnValue|ResolvedValue|RejectedValue)\(/
    const moduleConstant = new RegExp(
      String.raw`^(export )?const \w+ = ${loadTimeDefault.source}`,
      "m",
    )
    const offending = testFiles
      .filter(({ path }) => !path.startsWith("tests/integration/"))
      .filter(
        ({ source }) =>
          moduleConstant.test(source) ||
          callArguments(source, String.raw`vi\.mock`).some((factory) =>
            loadTimeDefault.test(factory),
          ),
      )
      .map(({ path }) => path)
    expect(offending).toEqual([])
  })

  it("aucun afterEach qui ne fait que rendre les vrais timers", () => {
    expect(
      offenders(/afterEach\(\(\) =>\s*\{?\s*vi\.useRealTimers\(\)\s*\}?\s*\)/),
    ).toEqual([])
  })

  it("next/link n'est mocké que là où le vrai ne peut rien prouver", () => {
    // Le vrai `Link` rend sous happy-dom. Restent : `prefetch={false}` (contrat
    // de coût Vercel), invisible dans le DOM, et l'état « en attente » de
    // `useLinkStatus`, inatteignable hors d'une vraie navigation.
    expect(
      offenders(/vi\.mock\(\s*"next\/link"/, [
        "tests/components/shared/shell/AdminShell.test.tsx",
        "tests/components/shared/shell/StudentShell.test.tsx",
        "tests/components/shared/LinkPendingIndicator.test.tsx",
      ]),
    ).toEqual([])
  })
})
