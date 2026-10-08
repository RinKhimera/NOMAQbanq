import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getInitials = (fullName: string | null | undefined): string => {
  if (!fullName) return "?"
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (parts.length === 0) return "?"
  // Découpage par point de code : `charAt(0)` couperait un emoji en deux.
  return parts.map((p) => [...p][0].toUpperCase()).join("")
}
