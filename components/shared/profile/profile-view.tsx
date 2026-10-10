import { ErrorState } from "@/components/shared/error-state"
import { SectionNav } from "@/components/shared/section-nav"
import type { NotificationPreferences } from "@/features/notifications/dal"
import type {
  CurrentUser,
  LoginMethods,
  UserSession,
} from "@/features/users/dal"
import type { AdminActivity } from "@/features/users/dal.activity"
import { ProfileAccountSection } from "./profile-account-section"
import { ProfileAdminActivity } from "./profile-admin-activity"
import { ProfileDangerZone } from "./profile-danger-zone"
import { ProfileHeader } from "./profile-header"
import {
  ProfileAdminNotifications,
  ProfileNotifications,
} from "./profile-notifications"
import { ProfilePersonalInfo } from "./profile-personal-info"
import { ProfilePreferences } from "./profile-preferences"
import { ProfileSection } from "./profile-section"
import { ProfileSessions } from "./profile-sessions"

const ACTIVITY_SECTION = { id: "activite", title: "Mon activité" } as const

const SECTIONS = [
  { id: "infos", title: "Informations personnelles" },
  { id: "connexion", title: "Connexion et sécurité" },
  { id: "preferences", title: "Préférences" },
  { id: "notifications", title: "Notifications" },
  { id: "appareils", title: "Appareils connectés" },
  { id: "suppression", title: "Supprimer le compte" },
] as const

const DEFAULT_PREFERENCES: NotificationPreferences = {
  examResults: true,
  accessExpiry: true,
  marketing: true,
  paymentAlerts: true,
}

type ProfileViewProps = {
  user: CurrentUser
  methods: LoginMethods | null
  sessions: UserSession[]
  notificationPreferences: NotificationPreferences | null
  /** Activité d'un administrateur ; `null` pour un candidat, ou si elle n'a pas pu se charger. */
  adminActivity: AdminActivity | null
  googleEnabled: boolean
  /** Retour de l'OAuth Google : le profil de la zone courante. */
  profilePath: string
}

/**
 * Profil, commun à l'espace étudiant et à l'administration. Un administrateur
 * y voit en plus son activité ; ses notifications se réduisent aux alertes de
 * paiement, et son compte ne se supprime pas depuis le profil.
 */
export const ProfileView = ({
  user,
  methods,
  sessions,
  notificationPreferences,
  adminActivity,
  googleEnabled,
  profilePath,
}: ProfileViewProps) => {
  const preferences = notificationPreferences ?? DEFAULT_PREFERENCES
  const isAdmin = user.role === "admin"
  const sections = [
    ...(isAdmin ? [ACTIVITY_SECTION] : []),
    // Sans méthodes de connexion, la section n'est pas rendue : son ancre
    // mènerait nulle part.
    ...(methods ? SECTIONS : SECTIONS.filter((s) => s.id !== "connexion")),
  ]

  return (
    <>
      <ProfileHeader user={user} />

      <div className="grid items-start gap-8 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <SectionNav
          items={sections}
          label="Sections du profil"
          mobileLabel="Sections du profil"
          className="top-[calc(var(--shell-offset)+2rem)]"
        />

        <div className="flex min-w-0 flex-col gap-4">
          {isAdmin && (
            <ProfileSection
              id={ACTIVITY_SECTION.id}
              title={ACTIVITY_SECTION.title}
              description="Ce que vous avez fait vous-même dans l'administration, depuis la création de votre compte."
            >
              {adminActivity ? (
                <ProfileAdminActivity activity={adminActivity} />
              ) : (
                <ErrorState
                  title="Impossible de charger votre activité"
                  description="Le reste du profil reste utilisable."
                  retryHref={profilePath}
                />
              )}
            </ProfileSection>
          )}

          <ProfileSection
            id="infos"
            title="Informations personnelles"
            description="Visibles uniquement par vous et l'équipe NOMAQbanq."
          >
            <ProfilePersonalInfo user={user} />
          </ProfileSection>

          {methods && (
            <ProfileSection id="connexion" title="Connexion et sécurité">
              <ProfileAccountSection
                methods={methods}
                email={user.email}
                googleEnabled={googleEnabled}
                profilePath={profilePath}
              />
            </ProfileSection>
          )}

          <ProfileSection id="preferences" title="Préférences">
            <ProfilePreferences />
          </ProfileSection>

          {isAdmin ? (
            <ProfileSection
              id="notifications"
              title="Notifications par courriel"
              description="Les courriels de sécurité du compte sont toujours envoyés."
            >
              <ProfileAdminNotifications
                paymentAlerts={preferences.paymentAlerts}
              />
            </ProfileSection>
          ) : (
            <ProfileSection
              id="notifications"
              title="Notifications par courriel"
              description="Les courriels de vérification, de réinitialisation, de bienvenue et de confirmation d'achat sont toujours envoyés."
            >
              <ProfileNotifications preferences={preferences} />
            </ProfileSection>
          )}

          <ProfileSection id="appareils" title="Appareils connectés">
            <ProfileSessions sessions={sessions} />
          </ProfileSection>

          {isAdmin ? (
            <ProfileSection id="suppression" title="Supprimer le compte">
              <p className="text-ink-2 text-[0.9375rem]">
                Un compte administrateur ne se supprime pas depuis le profil.
                Pour le faire supprimer, contactez un autre administrateur.
              </p>
            </ProfileSection>
          ) : (
            <ProfileSection
              id="suppression"
              title="Supprimer le compte"
              danger
              description="Votre compte est désactivé immédiatement. Vous avez 30 jours pour le réactiver en vous reconnectant ; ensuite, vos données personnelles sont anonymisées."
            >
              <ProfileDangerZone email={user.email} />
            </ProfileSection>
          )}
        </div>
      </div>
    </>
  )
}
