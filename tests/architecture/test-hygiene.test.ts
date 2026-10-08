import ts from "typescript"
import { describe, expect, it } from "vitest"
import { readSource, walk } from "./source-files"

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

const DEFAULT_SETTER =
  /^mock(Implementation|ReturnValue|ResolvedValue|RejectedValue)(Once)?$/
const RUNS_AT_LOAD = /^(describe|beforeAll|afterAll|vi\.mock|vi\.hoisted)\b/
const RUNS_PER_TEST = /^(it|test|beforeEach|afterEach)\b/

const isCallback = (node: ts.Node) =>
  ts.isArrowFunction(node) || ts.isFunctionExpression(node)

/**
 * Chaque appel `.méthode(…)` avec l'appel de framework qui l'exécute : `it`,
 * `beforeEach`… ou `describe`, `vi.mock`… ; `null` au niveau du module. Un
 * rappel passé à autre chose (`act`, `.map`) hérite du contexte ; une fonction
 * déclarée à part (helper) est appelée depuis un test, à un moment que
 * l'analyse ne connaît pas : `"helper"`, ignorée. Le contexte descend avec le
 * parcours : les pointeurs `parent` de l'AST ne sont pas fiables ici.
 */
const unitCalls = (
  method: (name: string) => boolean,
  offending: (callee: string | null) => boolean,
) =>
  testFiles
    .filter(({ path }) => !path.startsWith("tests/integration/"))
    .flatMap(({ path, source }) => {
      const file = ts.createSourceFile(
        path,
        source,
        ts.ScriptTarget.Latest,
        false,
        path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      )
      const found: string[] = []
      const visit = (node: ts.Node, context: string | null) => {
        if (!ts.isCallExpression(node)) {
          const inner =
            isCallback(node) ||
            ts.isFunctionDeclaration(node) ||
            ts.isMethodDeclaration(node)
              ? "helper"
              : context
          ts.forEachChild(node, (child) => visit(child, inner))
          return
        }
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          method(node.expression.name.text) &&
          context !== "helper" &&
          offending(context)
        ) {
          const { line } = file.getLineAndCharacterOfPosition(
            node.getStart(file),
          )
          found.push(`${path}:${line + 1} .${node.expression.name.text}`)
        }
        const callee = node.expression.getText(file)
        const framework =
          RUNS_AT_LOAD.test(callee) || RUNS_PER_TEST.test(callee)
        visit(node.expression, context)
        for (const arg of node.arguments) {
          if (!isCallback(arg)) visit(arg, context)
          else
            ts.forEachChild(arg, (child) =>
              visit(child, framework ? callee : context),
            )
        }
      }
      visit(file, null)
      return found
    })

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

  it("aucune implémentation posée au chargement : `mockReset` l'efface avant le test", () => {
    // `vi.fn(impl)` survit au reset (il revient à `impl`) ; un `.mockX(…)` posé
    // au niveau du module, d'un `describe`, d'un `beforeAll` ou d'une factory
    // `vi.mock` rend `undefined` dès le premier test, sans que rien ne rougisse.
    expect(
      unitCalls(
        (name) => DEFAULT_SETTER.test(name),
        (callee) => (callee === null ? true : RUNS_AT_LOAD.test(callee)),
      ),
    ).toEqual([])
  })

  it("aucun mockClear() en beforeEach/afterEach : la config le fait déjà", () => {
    expect(
      unitCalls(
        (name) => name === "mockClear",
        (callee) => callee !== null && /^(beforeEach|afterEach)\b/.test(callee),
      ),
    ).toEqual([])
  })

  it("aucun caractère de contrôle invisible", () => {
    // Un `\b` écrit par un script (Python, sed) devient l'octet 0x08 : la regex
    // qui le porte ne correspond plus à rien et son assertion passe à vide.
    const isControl = (char: string) =>
      char.charCodeAt(0) < 0x20 && !"\n\r\t".includes(char)
    expect(
      testFiles
        .filter(({ source }) => [...source].some(isControl))
        .map(({ path }) => path),
    ).toEqual([])
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
