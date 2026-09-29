"use client"

import { Check, GraduationCap, ListChecks, Play } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"
import { MultiChecklist } from "@/components/shared/multi-checklist"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PendingRegion } from "@/components/ui/pending-region"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import {
  createTrainingSession,
  loadAvailableObjectifsCMC,
  loadRevisionCounts,
} from "@/features/training/actions"
import type { ObjectifsView } from "@/features/training/dal"
import {
  EMPTY_REVISION_COUNTS,
  type RevisionCounts,
  revisionPoolSize,
} from "@/features/training/revision-pool"
import {
  MAX_OBJECTIFS,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  REVISION_CRITERIA,
  REVISION_CRITERION_LABELS,
  type RevisionCriterion,
  TRAINING_MODE_LABEL,
  notEnoughQuestions,
} from "@/features/training/schemas"
import { callAction } from "@/lib/safe-action"
import { TONE_SOFT } from "@/lib/tone"
import { cn } from "@/lib/utils"

type Objectif = ObjectifsView["objectifs"][number]

interface TrainingConfigFormProps {
  domains: { domain: string; count: number }[]
  totalQuestions: number
  /** Domaine demandé par l'URL, déjà validé ; `null` = tous les domaines. */
  initialDomain: string | null
  /** Objectifs du domaine demandé, chargés par la page (vide pour « tous »). */
  initialObjectifs: Objectif[]
  /** Une série en cours bloque « Commencer la série ». */
  hasActiveSeries: boolean
}

const ALL_DOMAINS = "all"
const QUESTION_MARKS = [5, 10, 15, 20]
const DEFAULT_COUNT = 10

const fmt = (n: number) => n.toLocaleString("fr-CA")
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

const Field = ({
  label,
  hint,
  trailing,
  children,
}: {
  label: string
  hint?: string
  trailing?: ReactNode
  children: ReactNode
}) => (
  <div className="flex flex-col gap-2.5">
    <span className="text-ink flex items-baseline justify-between gap-3 text-sm font-medium">
      <span>
        {label}
        {hint && <span className="text-ink-3 font-normal"> · {hint}</span>}
      </span>
      {trailing}
    </span>
    {children}
  </div>
)

const ModeCard = ({
  value,
  title,
  description,
  icon: Icon,
  checked,
}: {
  value: "test" | "tutor"
  title: string
  description: string
  icon: typeof Check
  checked: boolean
}) => (
  <Label
    htmlFor={`mode-${value}`}
    className={cn(
      "border-line-strong bg-surface hover:bg-surface-2 flex cursor-pointer flex-col items-stretch gap-1.5 rounded-md border px-4 py-3.5 leading-normal transition-[border-color,background-color] duration-(--duration-base) max-md:min-h-11",
      checked && "border-accent bg-accent-soft hover:bg-accent-soft",
    )}
  >
    <span className="flex items-center justify-between gap-2">
      <span className="text-ink flex items-center gap-2 text-base font-semibold">
        <Icon
          aria-hidden
          className={cn("size-4", checked ? "text-accent-ink" : "text-ink-3")}
        />
        {title}
      </span>
      <RadioGroupItem id={`mode-${value}`} value={value} />
    </span>
    <span className="text-ink-2 text-sm leading-normal font-normal">
      {description}
    </span>
  </Label>
)

const Recap = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="border-line flex items-center justify-between gap-3 border-b pb-2.5 text-sm">
    <span className="text-ink-3">{label}</span>
    <span className="text-ink text-right">{value}</span>
  </div>
)

export const TrainingConfigForm = ({
  domains,
  totalQuestions,
  initialDomain,
  initialObjectifs,
  hasActiveSeries,
}: TrainingConfigFormProps) => {
  const router = useRouter()
  const domainFromUrl = initialDomain ?? ALL_DOMAINS

  const [domain, setDomain] = useState(domainFromUrl)
  const [objectifs, setObjectifs] = useState<Objectif[]>([])
  const [objectifSearch, setObjectifSearch] = useState("")
  const [count, setCount] = useState(DEFAULT_COUNT)
  const [mode, setMode] = useState<"test" | "tutor">("test")
  const [revision, setRevision] = useState<RevisionCriterion[]>([])
  const [serverError, setServerError] = useState<string | null>(null)

  // Une navigation client vers la même page avec un autre `?domaine=` ne
  // remonte pas le formulaire : on réaligne l'état pendant le rendu.
  const [appliedDomainFromUrl, setAppliedDomainFromUrl] =
    useState(domainFromUrl)
  if (domainFromUrl !== appliedDomainFromUrl) {
    setAppliedDomainFromUrl(domainFromUrl)
    setDomain(domainFromUrl)
    setObjectifs([])
  }

  // Objectifs du domaine choisi : ceux de la page pour le domaine demandé,
  // rechargés par action pour tout autre. Suivis par domaine pour ne pas
  // remonter ceux d'un domaine précédent pendant le chargement ; un échec est
  // un état à part (relance proposée), jamais un spinner sans fin.
  const [objectifsFor, setObjectifsFor] = useState<{
    domain: string
    list: Objectif[]
    failed: boolean
  }>({ domain: domainFromUrl, list: initialObjectifs, failed: false })
  const [, startObjLoad] = useTransition()
  // Dernier domaine demandé : la réponse d'un domaine quitté entre-temps est
  // ignorée, sinon elle remplacerait la liste du domaine courant.
  const latestObjDomain = useRef(domainFromUrl)
  const loadObjectifs = useCallback(
    (forDomain: string) => {
      latestObjDomain.current = forDomain
      startObjLoad(async () => {
        let next: { list: Objectif[]; failed: boolean }
        try {
          const res = await loadAvailableObjectifsCMC(forDomain)
          next = { list: res.objectifs, failed: false }
        } catch {
          next = { list: [], failed: true }
        }
        if (latestObjDomain.current === forDomain) {
          setObjectifsFor({ domain: forDomain, ...next })
        }
      })
    },
    [startObjLoad],
  )
  useEffect(() => {
    if (domain === ALL_DOMAINS || objectifsFor.domain === domain) return
    loadObjectifs(domain)
  }, [domain, objectifsFor.domain, loadObjectifs])
  const objectifsReady =
    domain !== ALL_DOMAINS && objectifsFor.domain === domain
  const objectifList = objectifsReady ? objectifsFor.list : []

  // Compteurs de révision : recalculés au changement de domaine ou
  // d'objectifs. Clé sérialisée : `objectifs` change d'identité à chaque
  // setState, et chaque exécution balaie la banque de questions.
  const objectifsKey = JSON.stringify(objectifs.map((o) => o.objectif))
  const [counts, setCounts] = useState<{
    key: string
    value: RevisionCounts
  } | null>(null)
  const [, startCountsLoad] = useTransition()
  const countsKey = `${domain}|${objectifsKey}`
  // Dernière portée demandée : une réponse arrivée après un nouveau changement
  // (domaine A puis B, A répond en dernier) est ignorée, sinon le formulaire
  // attendrait une réponse qui ne viendra plus.
  const latestCountsKey = useRef(countsKey)
  useEffect(() => {
    latestCountsKey.current = countsKey
    startCountsLoad(async () => {
      try {
        const objectifsCMCs = JSON.parse(objectifsKey) as string[]
        const value = await loadRevisionCounts({
          domain: domain === ALL_DOMAINS ? undefined : domain,
          objectifsCMCs: objectifsCMCs.length > 0 ? objectifsCMCs : undefined,
        })
        if (latestCountsKey.current === countsKey)
          setCounts({ key: countsKey, value })
      } catch {
        // Sans ça, les pastilles resteraient à 0 en silence — l'étudiant
        // croirait n'avoir aucun historique. Le formulaire repart sur des
        // compteurs vides : la révision ciblée se ferme, le reste s'utilise.
        toast.error(
          "Impossible de charger vos compteurs de révision. Vérifiez votre réseau.",
        )
        if (latestCountsKey.current === countsKey) {
          setCounts({ key: countsKey, value: EMPTY_REVISION_COUNTS })
        }
      }
    })
  }, [domain, objectifsKey, countsKey])
  const countsReady = counts?.key === countsKey
  const revisionCounts = countsReady ? counts.value : EMPTY_REVISION_COUNTS
  // « Prêt » se lit sur les données de la portée courante, pas sur l'attente
  // d'une transition : une requête d'une portée quittée qui traîne ne bloque
  // rien.
  const loading = !countsReady || (domain !== ALL_DOMAINS && !objectifsReady)

  // ---- Dérivés ----
  const domainCount =
    domain === ALL_DOMAINS
      ? totalQuestions
      : (domains.find((d) => d.domain === domain)?.count ?? 0)
  const available =
    objectifs.length > 0
      ? objectifs.reduce((sum, o) => sum + o.count, 0)
      : domainCount

  // Un critère coché dont le compteur tombe à 0 (changement de domaine) ne
  // compte plus, sans qu'on ait à le décocher.
  const activeCriteria = revision.filter(
    (c) => !countsReady || revisionCounts[c] > 0,
  )
  const isRevision = activeCriteria.length > 0
  const pool = isRevision
    ? Math.min(available, revisionPoolSize(revisionCounts, activeCriteria))
    : available
  const minCount = isRevision ? 1 : MIN_QUESTIONS
  const maxCount = Math.min(MAX_QUESTIONS, pool)
  const tooFew = !isRevision && available < MIN_QUESTIONS
  const effectiveCount = Math.max(
    minCount,
    Math.min(count, Math.max(maxCount, minCount)),
  )
  const sliderDisabled = tooFew || maxCount <= minCount || loading
  const marks = [
    ...new Set([
      minCount,
      ...QUESTION_MARKS.filter((m) => m > minCount && m < maxCount),
      Math.max(maxCount, minCount),
    ]),
  ]

  const objectifOptions = objectifSearch
    ? objectifList.filter((o) =>
        normalize(o.objectif).includes(normalize(objectifSearch)),
      )
    : objectifList

  const chooseDomain = (next: string) => {
    setDomain(next)
    setObjectifs([])
    setObjectifSearch("")
    setServerError(null)
  }
  const chooseObjectifs = (next: Objectif[]) => {
    setObjectifs(next)
    setServerError(null)
  }
  const toggleRevision = (criterion: RevisionCriterion) => {
    setRevision((current) =>
      current.includes(criterion)
        ? current.filter((c) => c !== criterion)
        : [...current, criterion],
    )
    setServerError(null)
  }

  const [isPending, startSubmit] = useTransition()
  const blocked = hasActiveSeries || tooFew || loading || isPending
  const submit = () => {
    if (blocked) return
    startSubmit(async () => {
      // `callAction` ne throw jamais : un rejet réseau devient `success: false`
      // au lieu de contourner le garde ci-dessous.
      const result = await callAction(() =>
        createTrainingSession({
          questionCount: effectiveCount,
          domain: domain === ALL_DOMAINS ? undefined : domain,
          objectifsCMCs:
            objectifs.length > 0 ? objectifs.map((o) => o.objectif) : undefined,
          mode,
          revisionFilters: isRevision ? activeCriteria : undefined,
        }),
      )
      if (!result.success) {
        setServerError(result.error)
        return
      }
      // Le nombre annoncé est celui RETENU par le serveur : en révision, le
      // corpus peut être plus court que la demande.
      toast.success("Série créée !", {
        description: `${result.questionCount} ${result.questionCount > 1 ? "questions sélectionnées" : "question sélectionnée"}`,
      })
      router.push(`/tableau-de-bord/entrainement/${result.sessionId}`)
    })
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
      <section
        aria-labelledby="training-config-title"
        className="bg-surface border-line shadow-1 flex flex-col gap-6 rounded-lg border p-5 md:p-6"
      >
        <div className="flex flex-col gap-1">
          <p className="type-label">Nouvelle série</p>
          <h2 id="training-config-title" className="type-h4 text-ink">
            Configurer
          </h2>
        </div>

        <Field label="Domaine">
          <Select value={domain} onValueChange={chooseDomain}>
            <SelectTrigger
              className="h-10 w-full"
              aria-label="Domaine"
              data-testid="training-domain"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DOMAINS}>
                Tous les domaines
                <span className="text-ink-3 font-mono text-xs">
                  · {fmt(totalQuestions)}
                </span>
              </SelectItem>
              {domains.map((d) => (
                <SelectItem key={d.domain} value={d.domain}>
                  {d.domain}
                  <span className="text-ink-3 font-mono text-xs">
                    · {fmt(d.count)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Objectifs du CMC"
          hint={`optionnel, ${MAX_OBJECTIFS} au plus`}
        >
          {domain === ALL_DOMAINS ? (
            <p className="text-ink-3 text-sm">
              Choisissez un domaine pour cibler ses objectifs.
            </p>
          ) : !objectifsReady ? (
            <p className="text-ink-3 text-sm" aria-busy="true">
              Chargement des objectifs…
            </p>
          ) : objectifsFor.failed ? (
            <p className="text-ink-2 flex flex-wrap items-center gap-2 text-sm">
              Impossible de charger les objectifs de ce domaine.
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto px-0 text-sm"
                onClick={() => loadObjectifs(domain)}
              >
                Réessayer
              </Button>
            </p>
          ) : (
            <MultiChecklist<Objectif>
              options={objectifOptions}
              selected={objectifs}
              onChange={chooseObjectifs}
              getKey={(o) => o.objectif}
              getLabel={(o) => o.objectif}
              renderMeta={(o) => fmt(o.count)}
              search={objectifSearch}
              onSearchChange={setObjectifSearch}
              searchPlaceholder="Rechercher un objectif"
              emptyText={(q) => `Aucun objectif ne correspond à « ${q} ».`}
              label="Objectifs du CMC"
              maxSelections={MAX_OBJECTIFS}
              maxSelectionsLabel={(max) =>
                `Maximum de ${max} objectifs atteint`
              }
              footer={(n, total) =>
                `${n} / ${MAX_OBJECTIFS} sélectionné${n > 1 ? "s" : ""} · ${total} objectif${total > 1 ? "s" : ""}`
              }
            />
          )}
        </Field>

        <Field
          label="Nombre de questions"
          trailing={
            <span className="text-ink font-mono text-sm tabular-nums">
              {isRevision ? `jusqu'à ${effectiveCount}` : effectiveCount}
            </span>
          }
        >
          <Slider
            value={[effectiveCount]}
            onValueChange={([value]) => setCount(value)}
            min={minCount}
            max={sliderDisabled ? minCount + 1 : maxCount}
            step={1}
            disabled={sliderDisabled}
            aria-label="Nombre de questions"
          />
          <div className="flex flex-wrap gap-1.5">
            {marks.map((mark) => (
              <button
                key={mark}
                type="button"
                onClick={() => setCount(mark)}
                disabled={sliderDisabled}
                aria-pressed={effectiveCount === mark}
                className={cn(
                  "focus-ring text-ink-3 hover:bg-surface-2 hover:text-ink aria-pressed:bg-accent-soft aria-pressed:text-accent-ink inline-flex h-7 min-w-9 cursor-pointer items-center justify-center rounded-xs px-2 font-mono text-xs transition-colors disabled:pointer-events-none disabled:opacity-50 max-lg:h-11 max-lg:min-w-11",
                )}
              >
                {mark}
              </button>
            ))}
          </div>
          {isRevision && (
            <p className="text-ink-3 text-sm">
              Avec la révision ciblée, une série peut compter dès 1 question.
            </p>
          )}
        </Field>

        <Field label="Mode">
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as "test" | "tutor")}
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
          >
            <ModeCard
              value="test"
              title="Test"
              description="Correction seulement à la fin de la série."
              icon={ListChecks}
              checked={mode === "test"}
            />
            <ModeCard
              value="tutor"
              title="Tuteur"
              description="Correction immédiate : bonne réponse, explication et références. La réponse ne peut plus être modifiée."
              icon={GraduationCap}
              checked={mode === "tutor"}
            />
          </RadioGroup>
        </Field>

        <Field label="Révision ciblée" hint="optionnel, critères cumulables">
          <PendingRegion isPending={loading} className="flex flex-wrap gap-2">
            {REVISION_CRITERIA.map((criterion) => {
              const isActive = activeCriteria.includes(criterion)
              const value = revisionCounts[criterion]
              return (
                <button
                  key={criterion}
                  type="button"
                  data-testid={`revision-${criterion}`}
                  aria-pressed={isActive}
                  disabled={countsReady && value === 0}
                  onClick={() => toggleRevision(criterion)}
                  className={cn(
                    "focus-ring border-line-strong bg-surface text-ink-2 hover:bg-surface-2 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xs border px-2.5 text-sm font-medium transition-[background-color,border-color] disabled:cursor-not-allowed disabled:opacity-50 max-lg:h-11",
                    isActive &&
                      "border-accent bg-accent-soft text-accent-ink hover:bg-accent-soft",
                  )}
                >
                  {isActive && <Check aria-hidden className="size-3.5" />}
                  {REVISION_CRITERION_LABELS[criterion]}
                  <span
                    className={cn(
                      "font-mono text-xs tabular-nums",
                      isActive ? "text-accent-ink" : "text-ink-3",
                    )}
                  >
                    {countsReady ? fmt(value) : "—"}
                  </span>
                </button>
              )
            })}
          </PendingRegion>
          <p className="text-ink-3 text-sm leading-normal">
            Ratées : dernière réponse fausse, en série comme en examen blanc.
            Non vues : jamais répondues. Marquées : y compris pendant un examen
            blanc.
          </p>
        </Field>
      </section>

      <aside className="bg-surface-2 border-line flex flex-col gap-3.5 rounded-lg border p-5 lg:sticky lg:top-[calc(var(--shell-offset,0px)+1rem)]">
        <p className="type-label">Récapitulatif</p>
        <Recap
          label="Domaine"
          value={domain === ALL_DOMAINS ? "Tous les domaines" : domain}
        />
        <Recap
          label="Objectifs"
          value={
            objectifs.length > 0
              ? `${objectifs.length} sélectionné${objectifs.length > 1 ? "s" : ""}`
              : "Tous"
          }
        />
        <Recap
          label="Disponibles"
          value={
            <PendingRegion isPending={loading} className="inline-flex">
              {loading ? (
                <span className="text-ink-3">—</span>
              ) : (
                <span
                  className="font-mono tabular-nums"
                  data-testid="training-pool"
                >
                  {fmt(pool)} question{pool > 1 ? "s" : ""}
                </span>
              )}
            </PendingRegion>
          }
        />
        <Recap
          label="Questions"
          value={
            tooFew
              ? "—"
              : isRevision
                ? `Jusqu'à ${effectiveCount}`
                : effectiveCount
          }
        />
        <Recap label="Mode" value={TRAINING_MODE_LABEL[mode]} />
        <Recap
          label="Révision"
          value={
            isRevision
              ? activeCriteria
                  .map((c) => REVISION_CRITERION_LABELS[c])
                  .join(", ")
              : "Aucune"
          }
        />
        <Recap label="Chronomètre" value="Aucun" />
        {isRevision && !tooFew && (
          <p className="text-ink-3 -mt-1 text-sm leading-normal">
            Moins s&apos;il y en a moins parmi les questions retenues.
          </p>
        )}
        <Button
          size="lg"
          onClick={submit}
          disabled={blocked}
          data-testid="btn-start-training"
          className="w-full"
        >
          {isPending ? <Spinner size="sm" /> : <Play aria-hidden />}
          Commencer la série
        </Button>
        {tooFew && !loading && (
          <Alert className={TONE_SOFT.warning}>
            <AlertDescription className="text-warning-ink">
              {notEnoughQuestions(available)}
            </AlertDescription>
          </Alert>
        )}
        {hasActiveSeries && (
          <p className="text-ink-2 text-sm leading-normal">
            Terminez ou abandonnez votre série en cours pour en commencer une
            autre.
          </p>
        )}
        {serverError && (
          <Alert variant="destructive" data-testid="training-refusal">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
      </aside>
    </div>
  )
}
