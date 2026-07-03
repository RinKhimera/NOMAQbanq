// Parse léger d'un User-Agent en libellé lisible « Navigateur · Système ».
// Sans dépendance externe. L'ordre des règles compte (première correspondance
// gagne) : Edge/Opera contiennent "Chrome" ; un UA iPhone contient "Mac OS X" ;
// un UA Android contient "Linux".
type UaRule = readonly [RegExp, string]

const BROWSERS: readonly UaRule[] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Chrome\//, "Chrome"],
  [/Firefox\//, "Firefox"],
  [/Safari\//, "Safari"],
]

const SYSTEMS: readonly UaRule[] = [
  [/Windows/, "Windows"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Android/, "Android"],
  [/Linux/, "Linux"],
]

const matchRule = (ua: string, rules: readonly UaRule[], fallback: string) =>
  rules.find(([re]) => re.test(ua))?.[1] ?? fallback

export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Appareil inconnu"
  return `${matchRule(ua, BROWSERS, "Navigateur")} · ${matchRule(ua, SYSTEMS, "système inconnu")}`
}
