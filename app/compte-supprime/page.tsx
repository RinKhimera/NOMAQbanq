import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Compte supprimé — NOMAQbanq" }

export default function CompteSupprimePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Votre compte a été désactivé
      </h1>
      <p className="max-w-md text-gray-600 dark:text-gray-400">
        Vous avez 30 jours pour le réactiver : reconnectez-vous simplement avec
        vos identifiants avant la fin du délai. Passé cette date, vos données
        personnelles seront définitivement anonymisées.
      </p>
      <Button asChild>
        <Link href="/auth/sign-in">Se reconnecter</Link>
      </Button>
    </main>
  )
}
