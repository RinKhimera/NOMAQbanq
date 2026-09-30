import {
  Banknote,
  ClipboardPlus,
  type LucideIcon,
  Plus,
  Users,
} from "lucide-react"
import Link from "next/link"
import { DashboardPanel } from "./dashboard-panel"

const TILE =
  "focus-ring border-line bg-surface text-ink hover:bg-surface-2 hover:border-line-strong flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors"

const Tile = ({ icon: Icon, label }: { icon: LucideIcon; label: string }) => (
  <>
    <Icon aria-hidden="true" className="text-ink-3 size-4" />
    {label}
  </>
)

/** Raccourcis : question, examen, paiement, utilisateurs. */
export function QuickActions({
  onManualPaymentClick,
}: {
  onManualPaymentClick?: () => void
}) {
  return (
    <DashboardPanel eyebrow="Raccourcis" title="Actions rapides">
      <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
        <Link href="/admin/questions" prefetch={false} className={TILE}>
          <Tile icon={Plus} label="Ajouter une question" />
        </Link>
        <Link href="/admin/examens/creer" prefetch={false} className={TILE}>
          <Tile icon={ClipboardPlus} label="Créer un examen" />
        </Link>
        <button type="button" onClick={onManualPaymentClick} className={TILE}>
          <Tile icon={Banknote} label="Enregistrer un paiement" />
        </button>
        <Link href="/admin/utilisateurs" prefetch={false} className={TILE}>
          <Tile icon={Users} label="Gérer les utilisateurs" />
        </Link>
      </div>
    </DashboardPanel>
  )
}
