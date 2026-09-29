import type { Metadata } from "next"
import { ProfilePage } from "@/components/shared/profile/profile-page"

export const metadata: Metadata = { title: "Profil" }

export default function ProfilRoute() {
  return <ProfilePage profilePath="/tableau-de-bord/profil" />
}
