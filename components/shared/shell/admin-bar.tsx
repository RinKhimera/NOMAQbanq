import { Shield } from "lucide-react"

/**
 * Bandeau de la zone admin. Opaque : `--admin-soft` est translucide en thème
 * sombre, d'où le fond de page posé dessous, sans quoi le contenu défilerait
 * à travers.
 */
export const AdminBar = ({ envLabel }: { envLabel: string }) => (
  <div className="bg-background sticky top-0 z-40">
    <div className="bg-admin-soft text-admin-ink border-admin/30 flex h-8 items-center gap-2.5 border-b px-4 font-mono text-[11px] font-medium tracking-[0.06em] uppercase">
      <Shield aria-hidden className="size-3.25" />
      <span>Mode administration</span>
      <span className="rounded-xs border border-current px-1.5 py-0.5 leading-none">
        {envLabel}
      </span>
    </div>
  </div>
)
