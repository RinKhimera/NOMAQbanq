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
