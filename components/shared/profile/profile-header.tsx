import { AvatarUploader } from "@/components/shared/avatar-uploader"
import { StatusPill } from "@/components/shared/status-pill"
import type { CurrentUser } from "@/features/users/dal"
import { formatMonthYear } from "@/lib/format"

/** En-tête du profil : avatar et photo, nom (`h1`), courriel, rôle, ancienneté. */
export const ProfileHeader = ({ user }: { user: CurrentUser }) => (
  <div className="pb-2">
    <AvatarUploader
      currentAvatarUrl={user.image ?? undefined}
      name={user.name}
      size="xs"
    >
      <h1 className="type-h2 text-ink wrap-anywhere">{user.name}</h1>
      <p className="text-ink-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
        <span className="wrap-anywhere">{user.email}</span>
        {user.role === "admin" ? (
          <StatusPill tone="admin">Administrateur</StatusPill>
        ) : (
          <StatusPill tone="neutral">Étudiant</StatusPill>
        )}
        {user.createdAt && (
          <span>Membre depuis {formatMonthYear(user.createdAt)}</span>
        )}
      </p>
    </AvatarUploader>
  </div>
)
