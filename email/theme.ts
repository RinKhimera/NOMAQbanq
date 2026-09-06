// Jetons partagés par le layout et les composants courriel. Tout est explicite
// (hex, px) parce qu'un client courriel n'a ni variables CSS ni thème sombre
// fiable : les courriels sont clairs uniquement.
export const emailTheme = {
  colors: {
    accent: "#2563eb",
    accentEnd: "#4338ca",
    success: "#059669",
    warning: "#d97706",
    text: "#111827",
    muted: "#5b6577",
    footer: "#6b7280",
    page: "#f3f5fa",
    card: "#ffffff",
    border: "#e3e8f0",
    divider: "#eef1f6",
  },
  // Plus Jakarta Sans (police d'affichage du site) ne s'affiche que si elle est
  // installée chez le destinataire : aucune police web n'est chargée, pour ne
  // faire contacter aucun tiers à l'ouverture d'un courriel transactionnel.
  fontFamily:
    '"Plus Jakarta Sans", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
  radius: { card: "12px", button: "8px", table: "8px" },
  cardWidth: 480,
} as const

// Identité de l'expéditeur. L'adresse postale est exigée par la Loi canadienne
// anti-pourriel dans tout message commercial ; elle est publique par nature.
export const emailBrand = {
  name: "NOMAQbanq",
  tagline: "Préparation à l'EACMC Partie I",
  postalAddress: "114 rue Isabelle, Gatineau (Québec) J8Y 5H3",
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
