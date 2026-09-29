import { SectionNav } from "@/components/shared/section-nav"
import type { NotificationPreferences } from "@/features/notifications/dal"
import type {
  CurrentUser,
  LoginMethods,
  UserSession,
} from "@/features/users/dal"
import { ProfileAccountSection } from "./profile-account-section"
import { ProfileDangerZone } from "./profile-danger-zone"
import { ProfileHeader } from "./profile-header"
import { ProfileNotifications } from "./profile-notifications"
import { ProfilePersonalInfo } from "./profile-personal-info"
import { ProfilePreferences } from "./profile-preferences"
import { ProfileSection } from "./profile-section"
import { ProfileSessions } from "./profile-sessions"

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
}

type ProfileViewProps = {
  user: CurrentUser
  methods: LoginMethods | null
  sessions: UserSession[]
  notificationPreferences: NotificationPreferences | null
  googleEnabled: boolean
  /** Retour de l'OAuth Google : le profil de la zone courante. */
  profilePath: string
}

/** Profil, commun à l'espace étudiant et à l'administration. */
export const ProfileView = ({
  user,
  methods,
  sessions,
  notificationPreferences,
  googleEnabled,
  profilePath,
}: ProfileViewProps) => (
  <>
    <ProfileHeader user={user} />

    <div className="grid items-start gap-8 lg:grid-cols-[12.5rem_minmax(0,1fr)]">
      <SectionNav
        // Sans méthodes de connexion, la section n'est pas rendue : son ancre
        // mènerait nulle part.
        items={
          methods ? SECTIONS : SECTIONS.filter((s) => s.id !== "connexion")
        }
        label="Sections du profil"
        mobileLabel="Sections du profil"
        className="top-[calc(var(--shell-offset)+2rem)]"
      />

      <div className="flex min-w-0 flex-col gap-4">
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

        <ProfileSection
          id="notifications"
          title="Notifications par courriel"
          description="Les courriels de vérification, de réinitialisation, de bienvenue et de confirmation d'achat sont toujours envoyés."
        >
          <ProfileNotifications
            preferences={notificationPreferences ?? DEFAULT_PREFERENCES}
          />
        </ProfileSection>

        <ProfileSection id="appareils" title="Appareils connectés">
          <ProfileSessions sessions={sessions} />
        </ProfileSection>

        <ProfileSection
          id="suppression"
          title="Supprimer le compte"
          danger
          description="Votre compte est désactivé immédiatement. Vous avez 30 jours pour le réactiver en vous reconnectant ; ensuite, vos données personnelles sont anonymisées."
        >
          <ProfileDangerZone email={user.email} />
        </ProfileSection>
      </div>
    </div>
  </>
)
