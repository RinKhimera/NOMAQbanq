import type { Options } from "@react-email/render"

// Options du corps texte (envoi et aperçu). html-to-text met un titre `h1` en
// capitales par défaut, ce qui déformerait « NOMAQbanq ».
export const plainTextOptions = {
  plainText: true,
  htmlToTextOptions: {
    selectors: [{ selector: "h1", options: { uppercase: false } }],
  },
} satisfies Options
