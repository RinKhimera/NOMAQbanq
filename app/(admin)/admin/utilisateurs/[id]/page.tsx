import { UserX } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { getAvailableProducts } from "@/features/payments/dal"
import { getUserBans, getUserFile } from "@/features/users/dal"
import { requireRole } from "@/lib/auth-guards"
import { currentTimeMs } from "@/lib/clock"
import { UserFileClient } from "./_components/user-file-client"

export const metadata: Metadata = { title: "Fiche utilisateur" }

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // IDOR : garde admin explicite avant de manipuler un userId arbitraire, en
  // plus du layout admin et des gardes internes du DAL.
  const session = await requireRole(["admin"])
  const { id } = await params

  const [file, bans, products] = await Promise.all([
    getUserFile(id),
    getUserBans(id),
    getAvailableProducts(),
  ])

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {file ? (
        <UserFileClient
          file={file}
          bans={bans}
          products={products}
          currentUserId={session.user.id}
          initialNow={currentTimeMs()}
        />
      ) : (
        <>
          <nav aria-label="Fil d'Ariane" className="text-ink-3 text-sm">
            <Link href="/admin/utilisateurs" className="hover:text-ink">
              Utilisateurs
            </Link>{" "}
            › <span className="text-ink">Introuvable</span>
          </nav>
          <div className="bg-surface border-line rounded-lg border py-12">
            <EmptyState
              size="compact"
              icons={[UserX]}
              title="Utilisateur introuvable"
              description="Ce lien ne correspond à aucun compte. Le compte a peut-être été supprimé par l'étudiant : il est anonymisé après 30 jours et n'apparaît plus dans les listes."
            >
              <Button asChild variant="outline">
                <Link href="/admin/utilisateurs">Retour aux utilisateurs</Link>
              </Button>
            </EmptyState>
          </div>
        </>
      )}
    </div>
  )
}
