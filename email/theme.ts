// Jetons partagés par le layout et les composants courriel : les valeurs claires
// du design system, écrites en hex parce qu'un client courriel n'a ni variables
// CSS ni thème sombre fiable. Les courriels sont clairs uniquement.
export const emailTheme = {
  colors: {
    page: "#fbfbfa",
    card: "#ffffff",
    ink: "#0f172a",
    ink2: "#3f4a5c",
    ink3: "#5b6678",
    line: "#e6e4df",
    accent: "#2563eb",
  },
  tones: {
    info: { background: "#eff6ff", line: "#bfdbfe" },
    warning: { background: "#fffbeb", line: "#fde68a" },
    success: { background: "#ecfdf5", line: "#a7f3d0" },
  },
  // Polices système seulement : aucune police web n'est chargée, pour ne faire
  // contacter aucun tiers à l'ouverture d'un courriel.
  fonts: {
    serif: "Georgia, 'Times New Roman', Times, serif",
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    mono: "Menlo, Consolas, 'Courier New', monospace",
  },
  radius: { card: "6px", control: "4px" },
  cardWidth: 480,
} as const

// Identité de l'expéditeur. L'adresse postale est exigée par la Loi canadienne
// anti-pourriel dans tout message commercial ; elle est publique par nature.
export const emailBrand = {
  name: "NOMAQbanq",
  tagline: "Préparation à l'EACMC Partie I",
  postalAddress: "114 rue Isabelle, Gatineau (Québec) J8Y 5H3",
  // PNG (le SVG du site n'est pas affiché par Gmail ni Outlook), toujours sur
  // le domaine de production : le proxy d'images des webmails ne joint ni
  // localhost ni une prévisualisation Vercel protégée.
  logoUrl: "https://nomaqbanq.ca/icons/icon-192.png",
  links: {
    help: "/faq",
    terms: "/conditions",
    privacy: "/confidentialite",
    preferences: "/tableau-de-bord/profil",
  },
} as const
