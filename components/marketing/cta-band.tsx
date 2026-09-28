import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MARKETING_WRAP } from "./marketing-hero"

/**
 * Bande d'appel à l'action en fin de page. Section marine : une zone `.dark`
 * sur trame de points, pas un dégradé (DESIGN.md §3).
 */
export const CtaBand = () => (
  <section className="dark bg-background text-ink">
    <div className="bg-dots-fade py-16 md:py-20 lg:py-24">
      <div
        className={`${MARKETING_WRAP} relative flex flex-wrap items-end justify-between gap-8`}
      >
        <div className="flex max-w-160 flex-col gap-3.5">
          <h2 className="type-h1">
            Commencez votre préparation dès aujourd&apos;hui.
          </h2>
          <p className="type-body-lg">
            Rejoignez les candidats qui ont réussi grâce à NOMAQbanq.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button asChild size="lg">
            <Link href="/inscription">
              S&apos;inscrire
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/evaluation">Essayer l&apos;évaluation gratuite</Link>
          </Button>
        </div>
      </div>
    </div>
  </section>
)
