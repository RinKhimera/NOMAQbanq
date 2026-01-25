// Domain color mapping for medical specialties
export const domainColors: Record<string, string> = {
  Cardiologie:
    "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  Neurologie:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Pédiatrie:
    "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  Chirurgie: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Psychiatrie:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  "Gynécologie obstétrique":
    "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "Gastro-entérologie":
    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  Gastroentérologie:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  Pneumologie:
    "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  Néphrologie:
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  Endocrinologie:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Infectiologie:
    "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
  "Hémato-oncologie":
    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Rhumatologie:
    "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  Dermatologie:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  Ophtalmologie:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  ORL: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  Urologie: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Orthopédie:
    "bg-stone-100 text-stone-800 dark:bg-stone-900/40 dark:text-stone-300",
  "Anesthésie-Réanimation":
    "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  "Médecine interne":
    "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300",
  "Santé publique et médecine préventive":
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Autres: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

/**
 * Get the Tailwind color classes for a medical domain
 */
export function getDomainColor(domain: string): string {
  return (
    domainColors[domain] ||
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
  )
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + "..."
}
