import { Check, Minus } from "lucide-react"
import type { Metadata } from "next"
import type { ReactNode } from "react"
import { CtaBand } from "@/components/marketing/cta-band"
import { DemoQuestion } from "@/components/marketing/demo-question"
import {
  Eyebrow,
  MARKETING_SECTION,
  MARKETING_WRAP,
  MarketingHero,
} from "@/components/marketing/marketing-hero"
import { ScoreRing } from "@/components/shared/score-ring"
import { HERO_QUESTION } from "@/constants/sample-questions"
import { PASS_THRESHOLD, formatScore, scoreTone } from "@/lib/score"
import { TONE_COLOR } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { ExamSessionDemo, SeriesComposerDemo } from "./_components/demos"

export const metadata: Metadata = {
  title: "Comment ça marche",
  description:
    "Composer une série, apprendre en mode tuteur, se mettre en conditions d'examen, suivre sa progression : la méthode NOMAQbanq pour préparer l'EACMC Partie I.",
  alternates: {
    canonical: "https://nomaqbanq.ca/fonctionnement",
    languages: { "fr-CA": "https://nomaqbanq.ca/fonctionnement" },
  },
  openGraph: {
    title: "Comment ça marche | NOMAQbanq",
    description:
      "Une méthode en quatre temps pour préparer l'EACMC Partie I en français.",
  },
}

const DEMO_SCORES = [
  { label: "Cardiologie", value: 81 },
  { label: "Pneumologie", value: 74 },
  { label: "Pédiatrie", value: 69 },
  { label: "Neurologie", value: 58 },
  { label: "Psychiatrie", value: 47 },
]

const ProgressDemo = () => (
  <div className="bg-surface border-line rounded-lg border p-6">
    <div className="grid items-center gap-7 md:grid-cols-[auto_minmax(0,1fr)]">
      <ScoreRing value={72} size={120} strokeWidth={10} className="mx-auto" />
      <ul className="flex flex-col gap-3">
        {DEMO_SCORES.map((d) => (
          <li
            key={d.label}
            className="grid grid-cols-[130px_minmax(0,1fr)_40px] items-center gap-3 text-sm max-sm:grid-cols-[100px_minmax(0,1fr)_40px]"
          >
            <span className="text-ink-2 truncate">{d.label}</span>
            <span className="bg-surface-2 relative h-2 overflow-hidden rounded-xs">
              <span
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${d.value}%`,
                  background: TONE_COLOR[scoreTone(d.value)],
                }}
              />
              <span
                aria-hidden
                className="bg-ink-3 absolute inset-y-0 w-px"
                style={{ left: `${PASS_THRESHOLD}%` }}
              />
            </span>
            <span className="text-ink text-right font-mono text-xs tabular-nums">
              {formatScore(d.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
    <p className="border-line text-ink-3 mt-4.5 border-t pt-3.5 font-mono text-xs">
      Exemple de tableau de bord · seuil de réussite indicatif{" "}
      {formatScore(PASS_THRESHOLD)}
    </p>
  </div>
)

const STEPS: {
  title: string
  description: string
  points: string[]
  demo: ReactNode
}[] = [
  {
    title: "Composez votre série",
    description:
      "Choisissez un ou plusieurs domaines et le nombre de questions. La série démarre immédiatement.",
    points: [
      "Disciplines classées de façon systématique",
      "Niveaux de difficulté mélangés, avec des questions pièges",
      "Séries courtes pour réviser, longues pour s'entraîner",
    ],
    demo: <SeriesComposerDemo />,
  },
  {
    title: "Apprenez en mode tuteur",
    description:
      "La correction s'affiche dès que vous répondez, avec l'explication, les références et un point de synthèse.",
    points: [
      "Pourquoi la bonne réponse est correcte, et pourquoi les autres ne le sont pas",
      "Moyens mnémotechniques pour les points à haut rendement",
      "Explication et références repliables",
    ],
    demo: (
      <DemoQuestion
        question={HERO_QUESTION}
        mode="tutor"
        questionNumber={3}
        totalQuestions={20}
        initialAnswer={2}
      />
    ),
  },
  {
    title: "Mettez-vous en conditions d'examen",
    description:
      "En mode test et en examen blanc, la correction arrive à la fin, comme le jour de l'EACMC.",
    points: [
      "Chronomètre et navigation entre les questions",
      "Questions marquées pour y revenir",
      "Pause possible pendant un examen blanc",
    ],
    demo: <ExamSessionDemo />,
  },
  {
    title: "Suivez votre progression",
    description:
      "Vos résultats par domaine montrent où concentrer vos révisions avant l'examen.",
    points: [
      "Score moyen et évolution dans le temps",
      "Comparaison des domaines entre eux",
      "Historique des séries et examens",
    ],
    demo: <ProgressDemo />,
  },
]

const YES = (
  <>
    <Check aria-hidden className="text-success size-4" />
    <span className="sr-only">Oui</span>
  </>
)
const NO = (
  <>
    <Minus aria-hidden className="text-ink-3 size-4" />
    <span className="sr-only">Non</span>
  </>
)

const MODES = ["Tuteur", "Chronométré", "Examen blanc"]
const COMPARISON: { criterion: string; values: ReactNode[] }[] = [
  {
    criterion: "Correction",
    values: ["Après chaque question", "En fin de série", "En fin d'examen"],
  },
  { criterion: "Chronomètre", values: [NO, YES, YES] },
  { criterion: "Explications et références", values: [YES, YES, YES] },
  { criterion: "Pause", values: [YES, NO, YES] },
  {
    criterion: "Idéal pour",
    values: [
      "Apprendre un domaine",
      "Gérer son temps",
      "Valider sa préparation",
    ],
  },
]

export default function FonctionnementPage() {
  return (
    <>
      <MarketingHero
        label="Comment ça marche"
        title="Une méthode en quatre temps."
        description="Composer une série, apprendre en mode tuteur, se mettre en conditions d'examen, suivre sa progression. Voici comment chaque étape se présente dans l'application."
      />

      <section className={MARKETING_SECTION}>
        <ol className={cn(MARKETING_WRAP, "flex flex-col")}>
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className={cn(
                "grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-14",
                i > 0 && "border-line border-t py-10",
                i === 0 && "pb-10",
              )}
            >
              <div className="flex flex-col gap-3.5 lg:sticky lg:top-22">
                <span className="text-accent-ink font-mono text-[13px] tabular-nums">
                  Étape {i + 1} / {STEPS.length}
                </span>
                <h2 className="type-h2 text-ink">{step.title}</h2>
                <p className="text-ink-2 max-w-110 text-base leading-relaxed text-pretty">
                  {step.description}
                </p>
                <ul className="flex flex-col gap-2">
                  {step.points.map((point) => (
                    <li
                      key={point}
                      className="text-ink-2 flex items-start gap-2.5 text-[15px]"
                    >
                      <Check
                        aria-hidden
                        className="text-success mt-0.5 size-4 shrink-0"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0">{step.demo}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className={cn(MARKETING_SECTION, "bg-surface-2")}>
        <div className={MARKETING_WRAP}>
          <div className="mb-8 flex max-w-160 flex-col gap-3.5">
            <Eyebrow>Comparatif</Eyebrow>
            <h2 className="type-h2 text-ink">Quel mode choisir ?</h2>
          </div>
          {/* Positionnée : les libellés sr-only (absolus) restent dans la zone qui défile. */}
          <div className="border-line bg-surface relative overflow-x-auto rounded-lg border">
            <table className="w-full min-w-160 border-collapse text-left text-sm">
              <thead>
                <tr className="bg-surface-2">
                  <td />
                  {MODES.map((mode) => (
                    <th
                      key={mode}
                      scope="col"
                      className="type-label px-5 py-3.5 font-medium"
                    >
                      {mode}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.criterion} className="border-line border-t">
                    <th
                      scope="row"
                      className="text-ink px-5 py-3.5 font-medium"
                    >
                      {row.criterion}
                    </th>
                    {row.values.map((value, j) => (
                      <td key={MODES[j]} className="text-ink-2 px-5 py-3.5">
                        <span className="flex items-center">{value}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  )
}
