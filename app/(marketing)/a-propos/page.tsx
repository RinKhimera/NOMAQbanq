import { Mail, MapPin, Phone } from "lucide-react"
import { Metadata } from "next"
import { CtaBand } from "@/components/marketing/cta-band"
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
import { MARKETING_CLAIMS } from "@/constants"
import { testimonials } from "@/data/testimonials"
import { getCachedMarketingStats } from "@/features/marketing/cached"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "À propos",
  description: `Découvrez NOMAQbanq : notre mission, notre équipe et notre engagement envers la communauté médicale francophone. ${MARKETING_CLAIMS.successRate} de taux de réussite, des milliers de candidats accompagnés.`,
  alternates: {
    canonical: "https://nomaqbanq.ca/a-propos",
    languages: {
      "fr-CA": "https://nomaqbanq.ca/a-propos",
    },
  },
  openGraph: {
    title: "À propos de NOMAQbanq",
    description: `Notre mission : accompagner les médecins francophones vers la réussite à l'EACMC. ${MARKETING_CLAIMS.successRate} de taux de réussite, des milliers de candidats satisfaits.`,
    images: [
      {
        url: "/images/home-image.jpg",
        width: 1200,
        height: 630,
        alt: "NOMAQbanq - À propos de notre équipe",
      },
    ],
  },
}

// Aligné sur le cache des stats (1 semaine), invalidé plus tôt par leur tag :
// une page régénérée plus souvent referait le rendu pour les mêmes données.
export const revalidate = 604800

const VALUES = [
  {
    title: "Notre mission",
    description:
      "Accompagner les candidats francophones vers la réussite de l'EACMC avec des outils adaptés à leur réalité linguistique et culturelle.",
  },
  {
    title: "Notre communauté",
    description:
      "Une plateforme créée par des professionnels francophones ayant réussi l'examen, pour partager leur expertise et leur expérience.",
  },
  {
    title: "Notre engagement",
    description:
      "Fournir un contenu de qualité, régulièrement mis à jour selon les exigences de l'EACMC.",
  },
]

const CONTACT = [
  {
    Icon: Mail,
    label: "Courriel",
    value: (
      <a
        href="mailto:nomaqbanq@outlook.com"
        className="focus-ring text-accent-ink rounded-sm hover:underline"
      >
        nomaqbanq@outlook.com
      </a>
    ),
  },
  {
    Icon: Phone,
    label: "Téléphone",
    value: (
      <a
        href="tel:+14388750746"
        className="focus-ring rounded-sm font-mono tabular-nums hover:underline"
      >
        +1 (438) 875-0746
      </a>
    ),
  },
  {
    Icon: MapPin,
    label: "Adresse",
    value: "114 rue Isabelle, Gatineau (Québec) J8Y 5H3",
  },
]

export default async function AProposPage() {
  const stats = await getCachedMarketingStats()
  return (
    <>
      <MarketingHero
        label="À propos"
        title="D'une initiative à une communauté."
        description="NOMAQbanq est la première plateforme francophone de préparation à l'EACMC Partie I, basée à Gatineau (Québec)."
      />

      <section className={MARKETING_SECTION}>
        <div
          className={cn(
            MARKETING_WRAP,
            "grid items-start gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16",
          )}
        >
          <div className="flex flex-col gap-5">
            <Eyebrow>Notre histoire</Eyebrow>
            <p className="text-ink font-serif text-[1.375rem] leading-[1.55] text-pretty">
              NOMAQbanq est née d&apos;un constat simple : les candidats
              francophones à l&apos;EACMC manquaient de ressources adaptées à
              leur langue et à leur contexte culturel.
            </p>
            <p className="type-body-lg">
              Fondée par des professionnels de santé francophones ayant réussi
              l&apos;examen, notre plateforme combine expertise médicale et
              compréhension des défis propres aux candidats francophones.
            </p>
            <p className="type-body-lg">
              Aujourd&apos;hui, nous accompagnons des centaines de candidats,
              avec un taux de succès de {stats.successRate} parmi nos
              utilisateurs actifs.
            </p>
            <div className="pt-2">
              <ProofLine totalUsers={stats.totalUsers} />
            </div>
          </div>
          <MarketingFigures figures={publicFigures(stats)} layout="list" />
        </div>
      </section>

      <section className={MARKETING_SECTION}>
        <div className={MARKETING_WRAP}>
          <div className="mb-10 flex max-w-160 flex-col gap-3.5">
            <Eyebrow>Nos valeurs</Eyebrow>
            <h2 className="type-h1 text-ink">Ce qui nous anime</h2>
          </div>
          <FeatureCells items={VALUES} titleSize="h3" />
        </div>
      </section>

      <section className={cn(MARKETING_SECTION, "bg-surface-2")}>
        <div className={MARKETING_WRAP}>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col gap-3.5">
              <Eyebrow>Témoignages</Eyebrow>
              <h2 className="type-h2 text-ink">
                Ils se sont préparés avec nous
              </h2>
            </div>
            <span className="flex items-center gap-2">
              <Stars />
              <span className="text-ink font-mono text-sm tabular-nums">
                {MARKETING_CLAIMS.rating}
              </span>
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {testimonials.map((t) => (
              <figure
                key={t.id}
                className="bg-surface border-line flex flex-col justify-between gap-5 rounded-lg border p-7"
              >
                <blockquote className="text-ink font-serif text-lg leading-relaxed text-pretty">
                  « {t.content} »
                </blockquote>
                <figcaption className="flex items-center gap-3">
                  <UserAvatar
                    name={t.name}
                    image={null}
                    className="size-9"
                    fallbackClassName="bg-surface-2 text-ink-2 text-xs font-medium"
                  />
                  <div>
                    <p className="text-ink text-sm font-semibold">{t.name}</p>
                    <p className="text-ink-3 text-[13px]">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
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
          <div className="flex flex-col gap-3.5">
            <Eyebrow>Contact</Eyebrow>
            <h2 className="type-h2 text-ink">Nous joindre</h2>
            <p className="type-body-lg">
              Nous répondons généralement sous 24 h.
            </p>
          </div>
          <dl className="border-line divide-line divide-y border-y">
            {CONTACT.map(({ Icon, label, value }) => (
              <div
                key={label}
                className="text-ink grid grid-cols-[18px_110px_minmax(0,1fr)] items-center gap-3.5 py-4.5 text-[15px] max-sm:grid-cols-[18px_minmax(0,1fr)]"
              >
                <Icon aria-hidden className="text-ink-3 size-4" />
                <dt className="text-ink-3 text-sm">{label}</dt>
                <dd className="max-sm:col-start-2">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <CtaBand />
    </>
  )
}
