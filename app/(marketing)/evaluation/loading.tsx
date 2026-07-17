import { LoaderCircle } from "lucide-react"

// Fallback Suspense pendant que le Server Component du segment charge le DAL.
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoaderCircle
        className="text-muted-foreground h-8 w-8 animate-spin"
        aria-label="Chargement"
      />
    </div>
  )
}
