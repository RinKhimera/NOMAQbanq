import type { ErrorEvent, EventHint } from "@sentry/nextjs"

// Un tiers (traduction/extension) qui mute le DOM pendant le streaming fait
// crasher le script inline $RS de React avec ce message précis — pas un bug
// applicatif. Double condition volontairement étroite : ne jamais l'élargir
// sans audit d'hydratation préalable (voir .claude/rules/data-layer.md).
export function isThirdPartyRsCrash(
  event: ErrorEvent,
  hint: EventHint,
): boolean {
  const error = hint.originalException
  const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? []
  return (
    error instanceof TypeError &&
    error.message.includes("reading 'parentNode'") &&
    frames.some((f) => f.function === "$RS")
  )
}

const UNHANDLED_REJECTION = "auto.browser.global_handlers.onunhandledrejection"

// Message d'un fetch rejeté selon le navigateur (Chrome, Safari, Firefox). Le
// SDK y suffixe « (hôte) » quand l'URL demandée est absolue
// (`enhanceFetchErrorMessages`, actif par défaut). Une annulation (AbortError)
// n'en fait pas partie.
const NETWORK_FAILURE_MESSAGE =
  /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.)( \([^)]+\))?$/

// Le parseur de pile du SDK rend une frame d'extension Safari en
// `safari-extension:(//…/x.js)` ou `safari-web-extension://…/x.js`.
const EXTENSION_SCHEME = /^(chrome|moz|safari|safari-web)-extension:/

// La normalisation des frames du SDK Next réécrit l'origine d'une frame en
// `app://` (`chrome-extension://…/x.js` devient `app:///x.js`) : un fichier
// .js hors de `app:///_next/` n'est donc pas notre bundle. Selon le moteur, une
// origine non spéciale peut valoir « null » et échapper à cette réécriture,
// d'où le test du schéma brut. Les scripts inline (URL de page, sans .js) ne
// comptent pas.
const isForeignScript = (filename: string | undefined) =>
  !!filename &&
  (EXTENSION_SCHEME.test(filename) ||
    (filename.startsWith("app:///") &&
      !filename.startsWith("app:///_next/") &&
      /\.js(?:[?#]|$)/.test(filename)))

// Un script tiers qui enveloppe `window.fetch` laisse sa propre promesse sans
// `catch` : l'échec réseau d'une Server Action, déjà converti en échec
// structuré par `callAction`, ressort en « unhandled rejection » (NOMAQBANQ-1Q).
// Condition volontairement étroite : TypeError en rejet non géré, message
// d'échec réseau, et frame d'un script étranger dans la pile.
export function isThirdPartyFetchRejection(event: ErrorEvent): boolean {
  const values = event.exception?.values ?? []
  return values.some(
    (v) =>
      v.type === "TypeError" &&
      v.mechanism?.type === UNHANDLED_REJECTION &&
      NETWORK_FAILURE_MESSAGE.test(v.value ?? "") &&
      (v.stacktrace?.frames ?? []).some((f) => isForeignScript(f.filename)),
  )
}
