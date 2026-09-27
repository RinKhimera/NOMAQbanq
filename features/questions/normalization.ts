/**
 * Normalisation d'une correction collée (explication, références) : remise en
 * forme par règles fixes, sans jamais changer un mot du contenu, et stable
 * (l'appliquer à son propre résultat ne change rien). Module pur, partagé par
 * le formulaire admin, l'enregistrement serveur et le script de reprise.
 *
 * Deux niveaux :
 * - la partie SÛRE (`normalizeExplanation`, `tidyReference`) touche aux espaces,
 *   aux lignes vides et aux artefacts fixes ; le serveur l'applique à chaque
 *   enregistrement ;
 * - le DÉCOUPAGE des références (`normalizeReferenceEntry`,
 *   `splitReferenceEntry`) ne s'applique que sous les yeux de l'admin, jamais
 *   en silence à l'enregistrement.
 * Ce que les règles ne peuvent pas trancher est signalé par `diagnoseCorrection`.
 */

// Espaces « horizontaux » seulement : les espaces fines insécables (U+202F)
// devant la ponctuation française ne sont jamais touchées, d'où l'absence de
// `\s` et de `trim()` (qui les engloutiraient).
const HSPACE = "[ \\t]"

const MCC_FOOTER =
  /^Medical Council of Canada \| Le Conseil médical du Canada \| \d+$/

const CITATION_BODY = String.raw`\d+(?:[ \t]*[-–][ \t]*\d+)?(?:[ \t]*,[ \t]*\d+(?:[ \t]*[-–][ \t]*\d+)?)*`
const CITATION = new RegExp(String.raw`\[(${CITATION_BODY})\]`, "g")
const ISOLATED_CITATION_LINE = new RegExp(
  String.raw`^(?:\[${CITATION_BODY}\])+$`,
)
const GLUED_CITATION = new RegExp(
  String.raw`(?<=[\p{L}\p{N}])(?=\[${CITATION_BODY}\])`,
  "gu",
)

// Étiquettes qu'OpenEvidence colle à ses sources. Elles ne sont retirées que
// là où on les observe : seules sur leur ligne ; collées sans espace en fin de
// ligne (« et alGuideline », « PI.New ») ; après une fin de phrase ou
// « (2020) » pour les étiquettes de plusieurs mots (« …018. Practice
// Guideline ») ; « Guideline » juste après l'année quand la case des auteurs
// est vide (« 2013. Guideline »). Ailleurs, c'est un mot du texte : « Clinical
// Practice Guideline » en fin de titre, « 12e éd. New⏎York ».
const LABEL =
  "Practice Guideline|Leading Journal|New Research|Guideline|Review|New"
const LABEL_LINE = new RegExp(`^(?:(?:${LABEL})${HSPACE}*)+$`)
const MORE_LABELS = `(?: ?(?:${LABEL}))*$`
const TRAILING_LABELS = [
  new RegExp(`(?<=\\S)(?:${LABEL})${MORE_LABELS}`),
  new RegExp(
    `(?<=\\. |\\(\\d{4}\\) )(?:Practice Guideline|Leading Journal|New Research)${MORE_LABELS}`,
  ),
  new RegExp(`(?<=\\b(?:19|20)\\d{2}\\. )Guideline${MORE_LABELS}`),
]
// Texte alternatif du logo : « JAMA logoJAMA Neurology » → « JAMA Neurology ».
const JAMA_LOGO = /(?:\b(?:JAMA|Jama) )?logo(?=JAMA|Jama)/g

/** Partie sûre commune : espaces, lignes vides, artefacts invisibles ou fixes. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00ad/g, "")
    .split("\n")
    .map((line) =>
      line.replace(new RegExp(`${HSPACE}+`, "g"), " ").replace(/^ | $/g, ""),
    )
    .filter((line) => !MCC_FOOTER.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "")
}

/** Rattache un appel seul sur sa ligne à la ligne non vide qui précède. */
function attachIsolatedCitations(text: string): string {
  const lines: string[] = []
  for (const line of text.split("\n")) {
    const previous = lines.findLastIndex((l) => l !== "")
    if (ISOLATED_CITATION_LINE.test(line) && previous !== -1) {
      lines[previous] = `${lines[previous]} ${line}`
      lines.splice(previous + 1)
      continue
    }
    lines.push(line)
  }
  return lines.join("\n")
}

export function normalizeExplanation(text: string): string {
  return tidy(attachIsolatedCitations(tidy(text))).replace(GLUED_CITATION, " ")
}

/** Partie sûre d'une référence : jamais de découpage ni de jointure de lignes. */
export function tidyReference(entry: string): string {
  return tidy(entry)
}

/** Une source sur une seule ligne, débarrassée du bruit de l'outil source. */
function cleanSource(source: string): string {
  return tidy(source)
    .split("\n")
    .filter((line) => !LABEL_LINE.test(line))
    .map((line) =>
      TRAILING_LABELS.reduce((l, label) => l.replace(label, ""), line)
        .replace(JAMA_LOGO, "")
        .replace(/ $/, ""),
    )
    .filter((line) => line !== "")
    .join(" ")
    .replace(/ {2,}/g, " ")
}

type SeparatorStyle = "alone" | "inline" | "bracket"

const SEPARATORS: Record<SeparatorStyle, RegExp> = {
  alone: /^(\d{1,3})\.$/,
  inline: /^(\d{1,3})\. (\S.*)$/,
  bracket: /^\[(\d{1,3})\] ?(.*)$/,
}

type NumberedParse = {
  sources: string[]
  /** Numéro hors suite (trou, doublon) dans le style de la liste. */
  gap: boolean
  /** Du texte précède la première source numérotée. */
  preamble: boolean
}

/**
 * Découpe selon la numérotation. Un numéro n'est un séparateur que s'il est
 * le suivant attendu (1, puis 2…) : un titre de chapitre « 9. … » reste dans
 * sa source. Une entrée d'une seule ligne n'est jamais découpée, sans quoi un
 * titre « 1. … » déjà découpé perdrait son numéro au passage suivant.
 */
function parseNumbered(text: string): NumberedParse {
  const sources: string[][] = []
  let style: SeparatorStyle | null = null
  let preamble = false
  let gap = false
  if (!text.includes("\n")) return { sources: [], gap, preamble }

  for (const line of text.split("\n")) {
    const expected = sources.length + 1
    const match = (Object.keys(SEPARATORS) as SeparatorStyle[])
      .filter((s) => style === null || s === style)
      .map((s) => ({ s, m: SEPARATORS[s].exec(line) }))
      .find(({ m }) => m && Number(m[1]) === expected)
    if (match?.m) {
      style = match.s
      sources.push(match.m[2] ? [match.m[2]] : [])
      continue
    }
    const looksLikeSeparator =
      SEPARATORS.alone.test(line) ||
      SEPARATORS.bracket.test(line) ||
      (style === "inline" && SEPARATORS.inline.test(line))
    if (looksLikeSeparator) gap = true
    if (sources.length > 0) sources[sources.length - 1].push(line)
    else if (line !== "") preamble = true
  }
  return {
    sources: sources.map((lines) => lines.join("\n")).filter((s) => s !== ""),
    gap,
    preamble: preamble && sources.length > 0,
  }
}

const usableNumbering = (parse: NumberedParse) =>
  parse.sources.length > 0 && !parse.gap && !parse.preamble

// Repères de fin de source : « 2018;75(9) » (année;volume), « 2015. Findling »
// (année puis auteurs, format OpenEvidence), « ; 2019. » (ouvrage). Une source
// en porte un ; les années d'un DOI (« jtd.2018.02 ») ou d'une page web
// (« Published 2019. Updated 2023. ») n'en sont pas.
const SOURCE_END =
  /\b(?:19|20)\d{2};|(?<=\. )(?:19|20)\d{2}\. (?=\p{Lu})|; (?:19|20)\d{2}\.(?!\d)/gu
const looksLikeSeveralSources = (text: string) =>
  (text.match(SOURCE_END)?.length ?? 0) >= 2

/**
 * Normalisation complète d'un champ de référence, découpage compris : un bloc
 * numéroté donne une source par entrée, une source unique est nettoyée, un
 * bloc ambigu (sans numérotation exploitable) est seulement rangé — le
 * diagnostic le signale, l'admin tranche.
 */
export function normalizeReferenceEntry(entry: string): string[] {
  const text = tidy(entry)
  if (text === "") return []
  const parse = parseNumbered(text)
  if (usableNumbering(parse)) return parse.sources.map(cleanSource)
  if (parse.gap || parse.preamble || looksLikeSeveralSources(text)) {
    return [text]
  }
  return [cleanSource(text)]
}

export function normalizeReferences(entries: readonly string[]): string[] {
  return entries.flatMap(normalizeReferenceEntry)
}

const LEADING_SEPARATOR_LINE = /^(?:\d{1,3}\.|\[\d{1,3}\])\n/

/**
 * Bouton « Découper » : selon les numéros quand ils sont exploitables, sinon
 * selon les lignes vides que l'admin a insérées.
 */
export function splitReferenceEntry(entry: string): string[] {
  const text = tidy(entry)
  if (text === "") return []
  const parse = parseNumbered(text)
  if (usableNumbering(parse) && parse.sources.length > 1) {
    return parse.sources.map(cleanSource)
  }
  return text
    .split("\n\n")
    .map((part) => cleanSource(part.replace(LEADING_SEPARATOR_LINE, "")))
    .filter((part) => part !== "")
}

// ===== Diagnostic =====

export type FormatIssueCode =
  | "multiple-sources"
  | "numbering-gap"
  | "same-as-explanation"
  | "too-long"
  | "fda-sublist"
  | "pdf-line-breaks"
  | "lowercase-start"
  | "citation-out-of-range"

export type FormatIssue = {
  code: FormatIssueCode
  field: "explanation" | "references"
  /** Position de la référence concernée (base 0). */
  index?: number
  message: string
}

/** Au-delà, une entrée contient presque sûrement plusieurs sources ou autre chose. */
export const REFERENCE_WARN_LENGTH = 1000

const collapse = (text: string) => text.replace(/\s+/g, " ").trim()

const sameText = (a: string, b: string) => {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short === long || (short.length >= 200 && long.includes(short))
}

function diagnoseReference(
  entry: string,
  index: number,
  explanation: string,
): FormatIssue[] {
  const text = tidy(entry)
  const issues: FormatIssue[] = []
  const at = (code: FormatIssueCode, message: string) =>
    issues.push({ code, field: "references", index, message })

  const parse = parseNumbered(text)
  if (usableNumbering(parse) && parse.sources.length > 1) {
    at(
      "multiple-sources",
      `Ce champ contient ${parse.sources.length} sources numérotées : « Découper » les sépare en un champ chacune.`,
    )
  } else if (looksLikeSeveralSources(text)) {
    at(
      "multiple-sources",
      "Ce champ semble contenir plusieurs sources sans numérotation exploitable : séparez-les par une ligne vide, puis « Découper ».",
    )
  }
  if (parse.gap) {
    at(
      "numbering-gap",
      "La numérotation de ce champ est interrompue ou répétée : corrigez-la avant de découper.",
    )
  }
  if (explanation !== "" && sameText(collapse(text), collapse(explanation))) {
    at(
      "same-as-explanation",
      "Cette référence reprend le texte de l'explication.",
    )
  }
  if (text.length > REFERENCE_WARN_LENGTH) {
    at(
      "too-long",
      `Cette référence est anormalement longue (${text.length} caractères) : vérifiez qu'elle ne contient qu'une source.`,
    )
  }
  if (/Based on the following primary sources/i.test(text)) {
    at(
      "fda-sublist",
      "Cette source FDA embarque sa propre liste de sources primaires : gardez-la ou séparez-les.",
    )
  }
  return issues
}

function diagnoseExplanation(
  explanation: string,
  referenceCount: number,
): FormatIssue[] {
  const issues: FormatIssue[] = []
  const at = (code: FormatIssueCode, message: string) =>
    issues.push({ code, field: "explanation", message })

  if ((explanation.match(/[\p{Ll},]\n[\p{Ll}(]/gu)?.length ?? 0) >= 2) {
    at(
      "pdf-line-breaks",
      "L'explication semble coupée par des retours à la ligne de PDF, au milieu des phrases.",
    )
  }
  if (/^\p{Ll}/u.test(explanation)) {
    at(
      "lowercase-start",
      "L'explication commence par une minuscule : la première lettre a peut-être été perdue au copier-coller.",
    )
  }
  const outOfRange = [...explanation.matchAll(CITATION)].some((match) =>
    match[1]
      .split(/[,–-]/)
      .map(Number)
      .some((n) => n < 1 || n > referenceCount),
  )
  if (outOfRange) {
    at(
      "citation-out-of-range",
      referenceCount === 0
        ? "L'explication cite des références, mais la question n'en a aucune."
        : `L'explication cite une référence au-delà de la liste (${referenceCount} référence${referenceCount > 1 ? "s" : ""}).`,
    )
  }
  return issues
}

/** Motifs de mise en forme à vérifier, recalculés à la volée (rien n'est stocké). */
export function diagnoseCorrection({
  explanation,
  references,
}: {
  explanation: string
  references: readonly string[]
}): FormatIssue[] {
  const text = normalizeExplanation(explanation)
  const filled = references
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => tidy(entry) !== "")
  return [
    ...diagnoseExplanation(text, filled.length),
    ...filled.flatMap(({ entry, index }) =>
      diagnoseReference(entry, index, text),
    ),
  ]
}
