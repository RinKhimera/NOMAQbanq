import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getInitials = (fullName: string | null | undefined): string => {
  if (!fullName) return "?"
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (parts.length === 0) return "?"
  return parts.map(initialOf).join("")
}

/**
 * Première lettre en majuscule. Découpage par point de code : `charAt(0)`
 * couperait un emoji en deux. Une majuscule qui s'écrit en plusieurs lettres
 * (ß → SS) garde sa minuscule, faute de place dans l'avatar.
 */
const initialOf = (part: string): string => {
  const first = [...part][0]
  const upper = first.toUpperCase()
  return [...upper].length === 1 ? upper : first
}
