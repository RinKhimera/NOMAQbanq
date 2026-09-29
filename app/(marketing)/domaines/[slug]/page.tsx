import { ArrowRight, ArrowUpRight } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { chipClass } from "@/components/marketing/chip"
import { CtaBand } from "@/components/marketing/cta-band"
import { DemoQuestion } from "@/components/marketing/demo-question"
import { FeatureCells } from "@/components/marketing/feature-cells"
import {
  Eyebrow,
  MARKETING_SECTION,
  MARKETING_WRAP,
  MarketingHero,
} from "@/components/marketing/marketing-hero"
import { Button } from "@/components/ui/button"
import { DOMAINS, domainBySlug } from "@/constants/domains"
import {
  DOMAIN_SAMPLE_QUESTIONS,
  HERO_QUESTION_KEY_ONLY,
} from "@/constants/sample-questions"
import { cn } from "@/lib/utils"

type Props = { params: Promise<{ slug: string }> }

// Les 22 pages sont générées au build ; un slug hors liste est un 404.
export const dynamicParams = false

export function generateStaticParams() {
  return DOMAINS.map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const domain = domainBySlug((await params).slug)
  if (!domain) return {}
  const url = `https://nomaqbanq.ca/domaines/${domain.slug}`
  const description = `${domain.description}. Questions au format de l'EACMC Partie I, rattachées aux objectifs du CMC.`
  return {
    title: domain.name,
    description,
    alternates: { canonical: url, languages: { "fr-CA": url } },
    openGraph: { title: `${domain.name} | NOMAQbanq`, description, url },
  }
}

export default async function DomainPage({ params }: Props) {
  const domain = domainBySlug((await params).slug)
  if (!domain) notFound()

  const sample = DOMAIN_SAMPLE_QUESTIONS[domain.name]
  const siblings = DOMAINS.filter(
    (d) => d.group.id === domain.group.id && d.slug !== domain.slug,
  )
  const included = [
    {
      title: "Filtrage par domaine",
      description: `Créez une série limitée à ${domain.name}, ou combinez ce domaine avec d'autres.`,
    },
    {
      title: "Explications et références",
      description:
        "Chaque question est corrigée avec le raisonnement, les références et un point de synthèse.",
    },
    {
      title: "Suivi par domaine",
      description: `Votre score en ${domain.name} est suivi dans le temps, à côté des autres domaines.`,
    },
  ]

  return (
    <>
      <MarketingHero
        label={domain.group.label}
        title={domain.name}
        description={`${domain.description}. Des questions au format de l'EACMC Partie I, rattachées aux objectifs du CMC.`}
        breadcrumb={
          <nav aria-label="Fil d'Ariane">
            <ol className="text-ink-3 flex flex-wrap items-center gap-1.5 text-[13px]">
              <li>
                <Link
                  href="/"
                  className="focus-ring hover:text-ink rounded-sm max-md:inline-flex max-md:min-h-11 max-md:items-center"
                >
                  Accueil
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href="/domaines"
                  className="focus-ring hover:text-ink rounded-sm max-md:inline-flex max-md:min-h-11 max-md:items-center"
                >
                  Domaines
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-ink-2">
                {domain.name}
              </li>
            </ol>
          </nav>
        }
      >
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
      </MarketingHero>

      <section className={MARKETING_SECTION}>
        <div
          className={cn(
            MARKETING_WRAP,
            "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-14",
          )}
        >
          <div className="flex flex-col gap-3.5">
            <Eyebrow>Objectifs du CMC</Eyebrow>
            <h2 className="type-h2 text-ink">Ce que couvre ce domaine</h2>
            <p className="text-ink-2 text-[15px] leading-relaxed">
              Les questions sont rattachées aux objectifs du Conseil médical du
              Canada. En voici les principaux.
            </p>
          </div>
          <ol className="border-line border-t">
            {domain.objectives.map((objective, i) => (
              <li
                key={objective}
                className="border-line grid grid-cols-[32px_minmax(0,1fr)] items-baseline gap-3 border-b py-3.5"
              >
                <span
                  aria-hidden
                  className="text-ink-3 font-mono text-xs tabular-nums"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-ink text-base">{objective}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={cn(MARKETING_SECTION, "bg-surface-2")}>
        <div
          className={cn(
            MARKETING_WRAP,
            "grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14",
          )}
        >
          <div className="flex flex-col gap-4">
            <Eyebrow>
              {sample ? "Exemple de question" : "Évaluation gratuite"}
            </Eyebrow>
            <h2 className="type-h1 text-ink">
              {sample
                ? `Essayez une question de ${domain.name}.`
                : "Testez-vous avant de choisir."}
            </h2>
            <p className="type-body-lg">
              {sample
                ? "Une vignette clinique, quatre ou cinq choix, une seule bonne réponse. Avec un accès, chaque question est suivie de son explication et de ses références."
                : "Une série de questions tirées de plusieurs domaines, en conditions réelles, pour repérer vos points forts et vos lacunes."}
            </p>
            {!sample && (
              <div>
                <Button asChild size="lg">
                  <Link href="/evaluation/quiz">
                    Commencer l&apos;évaluation
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            )}
          </div>
          {sample ? (
            <DemoQuestion question={sample} mode="sample" />
          ) : (
            <DemoQuestion
              question={HERO_QUESTION_KEY_ONLY}
              mode="tutor"
              questionNumber={12}
              totalQuestions={50}
            />
          )}
        </div>
      </section>

      <section className={MARKETING_SECTION}>
        <div className={MARKETING_WRAP}>
          <div className="mb-10 flex max-w-160 flex-col gap-3.5">
            <Eyebrow>Avec un accès Entraînement</Eyebrow>
            <h2 className="type-h2 text-ink">
              Réviser {domain.name} sur NOMAQbanq
            </h2>
          </div>
          <FeatureCells items={included} />
        </div>
      </section>

      {siblings.length > 0 && (
        <section className={MARKETING_SECTION}>
          <div className={cn(MARKETING_WRAP, "flex flex-col gap-5")}>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div className="flex flex-col gap-2.5">
                <Eyebrow>{domain.group.label}</Eyebrow>
                <h2 className="type-h3 text-ink">Domaines voisins</h2>
              </div>
              <Link
                href="/domaines"
                className="focus-ring text-accent-ink rounded-sm text-sm hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center"
              >
                Tous les domaines →
              </Link>
            </div>
            <ul className="flex flex-wrap gap-2">
              {siblings.map((d) => (
                <li key={d.slug} className="max-w-full">
                  <Link href={`/domaines/${d.slug}`} className={chipClass()}>
                    {d.name}
                    <ArrowUpRight aria-hidden className="text-ink-3 size-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <CtaBand />
    </>
  )
}
