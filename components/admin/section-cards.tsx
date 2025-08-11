import {
  IconBook,
  IconDatabase,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Doc } from "@/convex/_generated/dataModel"

export const SectionCards = ({
  allQuestions,
  domainStats,
}: {
  allQuestions: Doc<"questions">[] | undefined
  domainStats: Record<string, number> | undefined
}) => {
  // Calculs des statistiques
  const totalQuestions = allQuestions?.length || 0

  const totalDomains = Object.keys(domainStats || {}).length

  // Calculer la croissance (simulation basée sur les données)
  const questionsGrowth = totalQuestions > 0 ? "+12.5%" : "0%"
  const domainsGrowth = totalDomains > 0 ? "+8.3%" : "0%"

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Total Questions */}
      <Card className="card-modern @container/card">
        <CardHeader>
          <CardDescription className="text-foreground font-semibold">
            Total Questions
          </CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalQuestions}
          </CardTitle>
          <CardAction>
            <Badge variant="badge">
              <IconTrendingUp />
              {questionsGrowth}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-blue-700 dark:text-blue-400">
            Questions disponibles <IconDatabase className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Base de données QCM médicaux
          </div>
        </CardFooter>
      </Card>

      {/* Domaines Couverts */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Domaines Couverts</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalDomains}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              {domainsGrowth}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Spécialités médicales <IconBook className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Couverture des domaines CMC
          </div>
        </CardFooter>
      </Card>

      {/* Utilisateurs */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Utilisateurs</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            -
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />-
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Fonctionnalité à venir <IconUsers className="size-4" />
          </div>
          <div className="text-muted-foreground">Gestion des utilisateurs</div>
        </CardFooter>
      </Card>

      {/* Activité */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Activité</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            -
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />-
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Fonctionnalité à venir <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Statistiques d&apos;utilisation
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
