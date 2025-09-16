import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getInitials = (fullName: string | null | undefined): string => {
  if (!fullName) return "?"
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (parts.length === 0) return "?"
  return (
    parts
      .map((p) => p.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2) || "?"
  )
}
