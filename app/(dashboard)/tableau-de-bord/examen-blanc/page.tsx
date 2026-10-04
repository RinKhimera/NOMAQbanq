import type { Metadata } from "next"
import { PageIntro } from "@/components/shared/page-intro"
import { getExamsWithParticipation } from "@/features/exams/dal"
import {
  getAvailableProducts,
  getMyLapsedAccess,
  hasAccess,
} from "@/features/payments/dal"
import { currentTimeMs } from "@/lib/clock"
import { getCurrentSession } from "@/lib/dal"
import { cheapestMonthly } from "@/lib/pricing"
import { ExamenBlancClient } from "./_components/examen-blanc-client"

export const EXAM_INTRO = {
  eyebrow: "Examens blancs",
  title: "Examens blancs",
  description:
    "Chaque examen est ouvert pendant quelques jours et se passe une seule fois. Les résultats et la correction sont publiés à sa fermeture.",
}

export const metadata: Metadata = { title: "Examens blancs" }

export default async function ExamenBlancPage() {
  const session = await getCurrentSession()
  const isAdmin = session?.user?.role === "admin"

  // Accès aux examens `subscribers` = abonnement actif (bypass admin). La liste
  // reste affichée sans lui : un bandeau dit ce qui manque, et l'éligibilité
  // par examen (un examen sur invitation présent = membre) se calcule au client.
  const [exams, hasExamAccess] = await Promise.all([
    getExamsWithParticipation(),
    isAdmin ? true : hasAccess("exam"),
  ])
  const [lapsed, products] = hasExamAccess
    ? [null, null]
    : await Promise.all([getMyLapsedAccess(), getAvailableProducts()])
  const monthly = products
    ? (cheapestMonthly(products, "exam") ?? cheapestMonthly(products))
    : undefined

  return (
    <>
      <PageIntro {...EXAM_INTRO} />
      <ExamenBlancClient
        exams={exams}
        hasExamAccess={hasExamAccess}
        accessExpiredAt={lapsed?.exam ?? null}
        priceFromCents={monthly?.priceCAD ?? null}
        initialNow={currentTimeMs()}
      />
    </>
  )
}
