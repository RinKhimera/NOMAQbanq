import { ArrowRight, Check } from "lucide-react"
import Link from "next/link"
import { CtaBand } from "@/components/marketing/cta-band"
import { DemoQuestion } from "@/components/marketing/demo-question"
import { type FaqItem, FaqSection } from "@/components/marketing/faq-section"
import { FeatureCells } from "@/components/marketing/feature-cells"
import {
  MarketingFigures,
  publicFigures,
} from "@/components/marketing/marketing-figures"
import {
  Eyebrow,
  MARKETING_SECTION,
  MARKETING_WRAP,
  MarketingHero,
} from "@/components/marketing/marketing-hero"
import { ProofLine, Stars } from "@/components/marketing/proof-line"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HERO_QUESTION_KEY_ONLY } from "@/constants/sample-questions"
import { testimonials } from "@/data/testimonials"
import type { MarketingStats } from "@/features/marketing/dal"
import { cn } from "@/lib/utils"

const FEATURES = [
  {
    title: "Modes chronométré et tuteur",
    description:
      "Selon votre emploi du temps et votre objectif, entraînez-vous en conditions d'examen ou avec la correction après chaque question.",
  },
  {
    title: "Points de synthèse",
    description:
      "À la fin de chaque cas clinique, les caractéristiques clés et les concepts importants sont résumés pour un rappel rapide.",
  },
  {
    title: "Disciplines",
    description:
      "Les matières cliniques sont classées de façon systématique pour tester un domaine précis ou réviser un sujet particulier.",
  },
  {
    title: "Suivi des performances",
    description:
      "Dans les deux modes, des commentaires détaillés vous aident à repérer vos points faibles.",
  },
  {
    title: "Niveaux de difficulté",
    description:
      "Des questions de niveau facile à avancé, avec des questions pièges pour vous préparer aux conditions réelles.",
  },
  {
    title: "Moyens mnémotechniques",
    description:
      "Les points cliniques à haut rendement sont résumés en un mot pour faciliter leur rappel pendant l'examen.",
  },
  {
    title: "Démarrage instantané",
    description:
      "Choisissez un sujet et commencez immédiatement, en mode tuteur ou chronométré.",
  },
  {
    title: "Mise à jour continue",
    description:
      "Questions, points de synthèse et algorithmes sont révisés en continu pour rester une source fiable.",
  },
]

const OFFER = [
  "Banque de questions pour 1 ou 6 mois",
  "Basé sur les objectifs du CMC",
  "Explications simples",
  "Moyens mnémotechniques",
  "Tableaux de synthèse et algorithmes",
  "Apprentissage à votre rythme",
]

const FAQ: FaqItem[] = [
  {
    question: "Les questions suivent-elles le format de l'EACMC Partie I ?",
    answer:
      "Oui. Chaque question reprend le format de l'examen : vignette clinique, quatre ou cinq choix et une seule bonne réponse, avec explication et références.",
  },
  {
    question: "Puis-je essayer avant de m'inscrire ?",
    answer:
      "Oui. L'évaluation gratuite vous donne accès à une série de questions en conditions réelles, sans carte de crédit.",
  },
  {
    question: "Puis-je mettre un examen blanc en pause ?",
    answer:
      "Oui, une fois par examen, quand l'examen le prévoit. Le chronomètre s'arrête pendant la pause et vos réponses sont conservées.",
  },
  {
    question: "La plateforme est-elle entièrement en français ?",
    answer:
      "Oui. NOMAQbanq est la première plateforme francophone de préparation à l'EACMC Partie I.",
  },
]

const OfferCard = ({ totalQuestions }: { totalQuestions: string }) => (
  <div className="bg-surface border-line overflow-hidden rounded-lg border">
    <div className="border-line flex items-center justify-between gap-3 border-b px-6 py-5.5">
      <div>
        <p className="text-ink text-base font-semibold">Accès complet</p>
        <p className="text-ink-3 text-[13px]">
          Entraînement, examens blancs, suivi
        </p>
      </div>
      <Badge variant="badge" className="font-mono">
        {totalQuestions} QCM
      </Badge>
    </div>
    <ul className="flex flex-col gap-3 px-6 py-5">
      {OFFER.map((item) => (
        <li
          key={item}
          className="text-ink-2 flex items-center gap-2.5 text-[15px]"
        >
          <Check aria-hidden className="text-success size-4 shrink-0" />
          {item}
        </li>
      ))}
    </ul>
    <div className="flex flex-col gap-2 px-6 pb-6">
      <Button asChild size="lg" className="w-full">
        <Link href="/inscription">S&apos;inscrire</Link>
      </Button>
      <Button asChild variant="ghost" className="w-full max-md:h-11">
        <Link href="/tarifs">Voir les tarifs</Link>
      </Button>
    </div>
  </div>
)

export default function HomeLanding({ stats }: { stats: MarketingStats }) {
  const [featured, ...others] = testimonials

  return (
    <>
      <MarketingHero
        size="display"
        label="EACMC Partie I · en français"
        title="Préparez l'EACMC Partie I avec méthode."
        description="Plus de 3000 QCM basés sur les objectifs du Conseil médical du Canada, des examens blancs chronométrés et un mode tuteur qui explique chaque réponse."
        aside={
          <DemoQuestion
            question={HERO_QUESTION_KEY_ONLY}
            mode="tutor"
            questionNumber={12}
            totalQuestions={50}
            caption="Exemple de question"
          />
        }
        band={<MarketingFigures figures={publicFigures(stats)} />}
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
        <div className="pt-2">
          <ProofLine totalUsers={stats.totalUsers} />
        </div>
      </MarketingHero>

      <section className={MARKETING_SECTION}>
        <div className={MARKETING_WRAP}>
          <div className="mb-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-14">
            <div className="flex flex-col gap-3.5">
              <Eyebrow>Fonctionnalités</Eyebrow>
              <h2 className="type-h1 text-ink">
                Tout ce qu&apos;il faut pour réviser, au même endroit.
              </h2>
            </div>
            <p className="type-body-lg self-end">
              Les objectifs du CMC décrivent ce que l&apos;on attend des
              diplômés qui visent la résidence au Canada. NOMAQbanq organise sa
              banque de questions autour de ces objectifs.
            </p>
          </div>
          <FeatureCells items={FEATURES} columns={4} />
        </div>
      </section>

      <section className={cn(MARKETING_SECTION, "bg-surface-2")}>
        <div className={MARKETING_WRAP}>
          <Eyebrow>Témoignages</Eyebrow>
          <div className="mt-6 grid items-start gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16">
            <figure className="flex flex-col gap-7">
              <blockquote className="text-ink font-serif text-[clamp(22px,2.4vw,30px)] leading-[1.4] font-medium text-pretty">
                « {featured.content} »
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <UserAvatar
                  name={featured.name}
                  image={null}
                  className="size-10"
                  fallbackClassName="bg-surface text-ink-2 text-sm font-medium"
                />
                <div>
                  <p className="text-ink text-[15px] font-semibold">
                    {featured.name}
                  </p>
                  <p className="text-ink-3 text-[13px]">{featured.role}</p>
                </div>
              </figcaption>
            </figure>
            <ul className="border-line-strong flex flex-col border-t">
              {others.map((t) => (
                <li
                  key={t.id}
                  className="border-line-strong flex flex-col gap-2.5 border-b py-5"
                >
                  <Stars rating={t.rating} />
                  <p className="text-ink-2 line-clamp-3 text-[15px] leading-relaxed">
                    {t.content}
                  </p>
                  <p className="text-ink-3 text-[13px]">
                    <strong className="text-ink font-semibold">{t.name}</strong>{" "}
                    · {t.role}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={MARKETING_SECTION}>
        <div
          className={cn(
            MARKETING_WRAP,
            "grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14",
          )}
        >
          <div className="flex flex-col gap-4">
            <Eyebrow>Banque de questions</Eyebrow>
            <h2 className="type-h1 text-ink">
              Un accès complet, à votre rythme.
            </h2>
            <p className="type-body-lg">
              Chaque question comprend une vignette clinique, cinq choix, une
              explication détaillée et un point de synthèse. Commencez par
              l&apos;évaluation gratuite pour vous situer.
            </p>
          </div>
          <OfferCard totalQuestions={stats.totalQuestions} />
        </div>
      </section>

      <FaqSection title="Questions fréquentes" items={FAQ} />
      <CtaBand />
    </>
  )
}
