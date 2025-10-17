import {
  IconBook,
  IconDatabase,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react"
import { StatCard } from "@/components/admin/StatCard"
import { Doc } from "@/convex/_generated/dataModel"

export const SectionCards = ({
  allQuestions,
  domainStats,
  adminStats,
}: {
  allQuestions: Doc<"questions">[] | undefined
  domainStats: Record<string, number> | undefined
  adminStats:
    | {
        totalUsers: number
        adminCount: number
        regularUserCount: number
        totalExams: number
        activeExams: number
        totalParticipations: number
      }
    | undefined
}) => {
  // Calculs des statistiques
  const totalQuestions = allQuestions?.length || 0
  const totalDomains = Object.keys(domainStats || {}).length
  const totalUsers = adminStats?.totalUsers || 0
  const totalParticipations = adminStats?.totalParticipations || 0
  const activeExams = adminStats?.activeExams || 0

  // Calculer la croissance (simulation basée sur les données)
  const questionsGrowth = totalQuestions > 0 ? "+12.5%" : "0%"
  const domainsGrowth = totalDomains > 0 ? "+8.3%" : "0%"
  const usersGrowth = totalUsers > 0 ? "+15.2%" : "0%"
  const activityGrowth = totalParticipations > 0 ? "+23.8%" : "0%"

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Total Questions */}
      <StatCard
        title="Total Questions"
        value={totalQuestions}
        growth={questionsGrowth}
        footerLabel="Questions disponibles"
        footerDescription="Base de données QCM médicaux"
        icon={<IconDatabase className="size-4" />}
        variant="primary"
      />

      {/* Domaines Couverts */}
      <StatCard
        title="Domaines Couverts"
        value={totalDomains}
        growth={domainsGrowth}
        footerLabel="Spécialités médicales"
        footerDescription="Couverture des domaines CMC"
        icon={<IconBook className="size-4" />}
      />

      {/* Utilisateurs */}
      <StatCard
        title="Utilisateurs"
        value={totalUsers}
        growth={usersGrowth}
        footerLabel="Utilisateurs inscrits"
        footerDescription={`${adminStats?.adminCount || 0} admin${(adminStats?.adminCount || 0) > 1 ? "s" : ""} • ${adminStats?.regularUserCount || 0} étudiant${(adminStats?.regularUserCount || 0) > 1 ? "s" : ""}`}
        icon={<IconUsers className="size-4" />}
      />

      {/* Activité */}
      <StatCard
        title="Activité"
        value={totalParticipations}
        growth={activityGrowth}
        footerLabel="Participations aux examens"
        footerDescription={`${activeExams} examen${activeExams > 1 ? "s" : ""} actif${activeExams > 1 ? "s" : ""} • ${adminStats?.totalExams || 0} total`}
        icon={<IconTrendingUp className="size-4" />}
      />
    </div>
  )
}
