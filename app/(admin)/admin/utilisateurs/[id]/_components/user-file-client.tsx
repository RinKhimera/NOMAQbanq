"use client"

import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Receipt,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import { type ReactNode, useState } from "react"
import { CopyId } from "@/components/shared/copy-id"
import { ACCESS_TYPE_LABEL } from "@/components/shared/payments/access-badge"
import { ManualPaymentFlow } from "@/components/shared/payments/manual-payment-dialog"
import { TransactionStatusWithDispute } from "@/components/shared/payments/transaction-status"
import { RelativeTime } from "@/components/shared/relative-time"
import { BannedPill, StatusPill } from "@/components/shared/status-pill"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import type { ProductView } from "@/features/payments/dal"
import type { UserBanView, UserFile } from "@/features/users/dal"
import { clientFileHref } from "@/lib/admin-links"
import {
  NBSP,
  formatCurrency,
  formatMediumDate,
  formatMediumDateTime,
} from "@/lib/format"
import { scoreTextClass } from "@/lib/score"
import { cn } from "@/lib/utils"
import {
  accessState,
  isBackfilledLogin,
  loginMethodsLabel,
  userLabel,
} from "../../_components/user-labels"
import { UserBanSection } from "./user-ban-section"
import { UserRoleSection } from "./user-role-section"

const Section = ({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) => (
  <section className="bg-surface border-line flex min-w-0 flex-col gap-3.5 rounded-lg border px-5.5 py-5 max-md:p-4">
    <div className="flex flex-col gap-0.5">
      <span className="type-label">{eyebrow}</span>
      <h2 className="type-h4 text-ink">{title}</h2>
    </div>
    {children}
  </section>
)

const KV = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="flex w-full flex-col">
    {rows.map(([k, v]) => (
      <div
        key={k}
        className="border-line grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-t py-2.5 text-sm first:border-t-0 max-md:grid-cols-1 max-md:gap-0.5"
      >
        <dt className="text-ink-3">{k}</dt>
        <dd className="text-ink wrap-anywhere">{v}</dd>
      </div>
    ))}
  </dl>
)

const Muted = ({ children }: { children: ReactNode }) => (
  <span className="text-ink-3">{children}</span>
)

const AccessBlock = ({
  file,
  now,
  onGrant,
}: {
  file: UserFile
  now: number
  onGrant: () => void
}) => {
  if (file.user.role === "admin")
    return (
      <div className="flex items-start gap-2.5 text-sm">
        <ShieldCheck aria-hidden="true" className="text-ink-3 mt-0.5 size-4" />
        <span>
          <span className="text-ink font-medium">
            Accès illimité (administrateur)
          </span>
          <br />
          <span className="text-ink-3 text-[0.8125rem]">
            Un administrateur n&apos;est jamais bloqué par les accès.
          </span>
        </span>
      </div>
    )

  return (
    <div className="flex flex-col">
      {(["exam", "training"] as const).map((type) => {
        const a = accessState(file.access[type], now)
        const stripe = file.accessPaidBy[type] === "stripe"
        return (
          <div
            key={type}
            data-testid={`access-${type}`}
            className="border-line flex flex-col gap-1 border-t py-3 first:border-t-0 first:pt-0"
          >
            <span className="type-label">Accès {ACCESS_TYPE_LABEL[type]}</span>
            {a.state === "never" ? (
              <span className="text-ink-3 font-serif text-xl font-semibold">
                {file.refunded[type]
                  ? "Retiré après remboursement"
                  : "Jamais eu"}
              </span>
            ) : a.state === "expired" ? (
              <span className="text-ink-2 font-serif text-xl font-semibold">
                Expiré le {formatMediumDate(a.expiresAt)}
              </span>
            ) : (
              <>
                <span
                  className={cn(
                    "font-serif text-xl font-semibold",
                    a.state === "expiring"
                      ? "text-warning-ink"
                      : "text-success-ink",
                  )}
                >
                  Actif jusqu&apos;au {formatMediumDate(a.expiresAt)}{" "}
                  <span className="font-mono text-[0.8125rem] font-normal">
                    · {a.days}
                    {NBSP}j restants
                  </span>
                </span>
                <span className="text-ink-3 text-xs leading-normal">
                  Pour retirer cet accès, remboursez ou supprimez le paiement
                  correspondant
                  {stripe
                    ? " (payé par Stripe : remboursement dans Stripe)"
                    : ""}
                  .
                </span>
              </>
            )}
          </div>
        )
      })}
      <div className="border-line flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3.5">
        <Button type="button" onClick={onGrant} data-testid="grant-access">
          <Plus aria-hidden="true" />
          Accorder ou prolonger un accès
        </Button>
        <span className="text-ink-3 flex-[1_1_220px] text-xs">
          Enregistre un paiement manuel ; un accès actif est prolongé. Aucun
          courriel n&apos;est envoyé.
        </span>
      </div>
    </div>
  )
}

const PaymentsBlock = ({ file }: { file: UserFile }) => {
  const p = file.payments
  return (
    <div className="flex flex-col items-start gap-3.5">
      {p ? (
        <KV
          rows={[
            [
              "Dernier paiement",
              <span key="v" className="flex flex-col gap-1">
                <span>
                  {formatMediumDate(p.last.createdAt)} ·{" "}
                  {p.last.productName ?? "Produit inconnu"}
                </span>
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="font-mono">
                    {formatCurrency(p.last.amountPaid, p.last.currency)}
                  </span>
                  <TransactionStatusWithDispute transaction={p.last} />
                </span>
              </span>,
            ],
            [
              "Total payé",
              <span key="v" className="font-mono">
                {formatCurrency(p.totalCad)}
                {p.totalXaf > 0
                  ? ` · ${formatCurrency(p.totalXaf, "XAF")}`
                  : ""}
              </span>,
            ],
            [
              "Transactions",
              <span key="v" className="font-mono">
                {p.count}
              </span>,
            ],
          ]}
        />
      ) : (
        <p className="text-ink-3 text-sm">
          Ce compte n&apos;a jamais tenté de payer.
        </p>
      )}
      {p ? (
        <Button asChild variant="outline">
          <Link href={clientFileHref(file.user.id)}>
            <Receipt aria-hidden="true" />
            Voir le dossier de paiement
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="outline" disabled>
          Aucun paiement
        </Button>
      )}
    </div>
  )
}

const PARTICIPATION_STATUS = {
  in_progress: { tone: "warning", label: "En cours" },
  completed: { tone: "neutral", label: "Soumis" },
  auto_submitted: { tone: "neutral", label: "Soumis automatiquement" },
} as const

const VISIBLE_PARTICIPATIONS = 3

const Activity = ({ file, now }: { file: UserFile; now: number }) => {
  const [all, setAll] = useState(false)
  const a = file.activity
  const shown = all
    ? a.participations
    : a.participations.slice(0, VISIBLE_PARTICIPATIONS)
  const empty = a.participationCount === 0 && !a.series && a.bookmarkCount === 0

  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex flex-col gap-1.5">
        <span className="type-label">Dernière activité</span>
        {a.lastActivity ? (
          <span className="text-ink text-sm">
            {a.lastActivity.kind === "participation"
              ? "Participation"
              : "Série d'entraînement"}{" "}
            · {a.lastActivity.label}{" "}
            <span className="text-ink-3 font-mono">
              · {formatMediumDateTime(a.lastActivity.at)} (
              <RelativeTime timestamp={a.lastActivity.at} />)
            </span>
          </span>
        ) : (
          <span className="text-ink-3 text-sm">
            Aucune activité depuis l&apos;inscription.
          </span>
        )}
      </div>

      {!empty && (
        <>
          <div className="flex flex-col items-start gap-1.5">
            <span className="type-label">
              Examens blancs · {a.participationCount} participation
              {a.participationCount > 1 ? "s" : ""}
            </span>
            {a.participationCount === 0 ? (
              <span className="text-ink-3 text-sm">Aucune participation.</span>
            ) : (
              <div className="border-line flex w-full flex-col rounded-md border">
                {shown.map((p) => {
                  const st = PARTICIPATION_STATUS[p.status]
                  const held = p.status !== "in_progress" && p.examEndsAt > now
                  return (
                    <div
                      key={p.id}
                      data-testid={`participation-${p.id}`}
                      className="border-line grid grid-cols-[minmax(0,1fr)_auto_110px] items-center gap-3 border-t px-3.5 py-2.5 text-sm first:border-t-0 max-md:grid-cols-1 max-md:gap-1.5"
                    >
                      <span className="min-w-0">
                        <span className="text-ink font-medium">
                          {p.examTitle}
                        </span>
                        <br />
                        <span className="text-ink-3 font-mono text-xs">
                          {formatMediumDate(p.at)}
                        </span>
                      </span>
                      <StatusPill
                        tone={st.tone}
                        className="justify-self-start md:justify-self-auto"
                      >
                        {st.label}
                      </StatusPill>
                      <span className="text-right max-md:text-left">
                        {p.status === "in_progress" ? (
                          <Muted>—</Muted>
                        ) : (
                          <span
                            className={cn(
                              "font-mono",
                              scoreTextClass(Math.floor(p.score)),
                            )}
                          >
                            {Math.floor(p.score)}
                            {NBSP}%
                          </span>
                        )}
                        {held && (
                          <span className="text-ink-3 mt-0.5 block text-xs leading-snug">
                            Non publié à l&apos;étudiant avant le{" "}
                            {formatMediumDate(p.examEndsAt)}
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            {a.participationCount > VISIBLE_PARTICIPATIONS && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAll(!all)}
                className="max-lg:h-11"
              >
                {all ? (
                  <ChevronUp aria-hidden="true" />
                ) : (
                  <ChevronDown aria-hidden="true" />
                )}
                {all ? "Réduire" : `Voir tout (${a.participationCount})`}
              </Button>
            )}
          </div>

          <div className="border-line grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] rounded-md border max-md:grid-cols-1">
            <div className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
              <span className="type-label">Séries d&apos;entraînement</span>
              {a.series ? (
                <>
                  <span className="text-ink font-serif text-[1.625rem] leading-tight font-semibold">
                    {a.series.count}
                  </span>
                  <span className="text-ink-2 text-[0.8125rem] leading-normal">
                    dernière le {formatMediumDate(a.series.lastAt)}
                    {a.series.average !== null && (
                      <>
                        {" "}
                        · moyenne{" "}
                        <span
                          className={cn(
                            "font-mono",
                            scoreTextClass(a.series.average),
                          )}
                        >
                          {a.series.average}
                          {NBSP}%
                        </span>
                      </>
                    )}{" "}
                    · tuteur {a.series.tutorShare}
                    {NBSP}% / test {100 - a.series.tutorShare}
                    {NBSP}%
                  </span>
                </>
              ) : (
                <span className="text-ink-2 text-[0.8125rem]">
                  Aucune série
                </span>
              )}
            </div>
            <div className="border-line flex flex-col gap-1 px-3.5 py-3 max-md:border-t md:border-l">
              <span className="type-label">Questions marquées</span>
              <span className="text-ink font-serif text-[1.625rem] leading-tight font-semibold">
                {a.bookmarkCount}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const Identity = ({ file }: { file: UserFile }) => {
  const u = file.user
  return (
    <KV
      rows={[
        [
          "Inscrit le",
          <span key="v" className="font-mono">
            {formatMediumDate(u.createdAt)}
          </span>,
        ],
        [
          "Connexion",
          u.imported ? (
            <span key="v" className="text-ink-2">
              Compte importé, jamais connecté depuis la migration de juin 2026
              <br />
              <span className="text-ink-3 text-xs">
                Sa méthode de connexion s&apos;enregistrera à sa première
                connexion.
              </span>
            </span>
          ) : (
            loginMethodsLabel(u.loginMethods)
          ),
        ],
        [
          "Dernière connexion",
          u.lastLoginAt === null ? (
            <Muted key="v">—</Muted>
          ) : (
            <span key="v">
              <span className="font-mono">
                {formatMediumDate(u.lastLoginAt)}
              </span>
              {isBackfilledLogin(u.lastLoginAt) && (
                <>
                  <br />
                  <span className="text-ink-3 text-xs">
                    Valeur remplie d&apos;office pour tous les comptes
                  </span>
                </>
              )}
            </span>
          ),
        ],
        ["Biographie", u.bio?.trim() || <Muted key="v">Aucune</Muted>],
        ["Identifiant", <CopyId key="v" id={u.id} />],
      ]}
    />
  )
}

const Communications = ({ file }: { file: UserFile }) => {
  const { prefs, sent } = file.communications
  const yes = (v: boolean) =>
    v ? <span className="text-ink">Oui</span> : <Muted>Non</Muted>
  const date = (at: number | null, fallback = "Non envoyé") =>
    at === null ? (
      <Muted>{fallback}</Muted>
    ) : (
      <span className="font-mono">{formatMediumDateTime(at)}</span>
    )
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3 max-md:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="type-label">Préférences de l&apos;étudiant</span>
        <KV
          rows={[
            ["Résultats d'examen", yes(prefs.examResults)],
            ["Expiration d'accès", yes(prefs.accessExpiry)],
            ["Courriels commerciaux", yes(prefs.marketing)],
          ]}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="type-label">Courriels envoyés</span>
        <KV
          rows={[
            [
              "Bienvenue",
              date(
                sent.welcome,
                file.user.imported
                  ? "Avant la migration, non repris"
                  : "Non envoyé",
              ),
            ],
            ["Relance d'inactivité", date(sent.inactivity)],
            ["Panier abandonné", date(sent.cart)],
            ["Rappel d'expiration", date(sent.expiry)],
          ]}
        />
      </div>
    </div>
  )
}

/**
 * Fiche d'un compte : les accès en tête avec l'unique action « Accorder ou
 * prolonger », le résumé des paiements (l'historique vit dans le dossier de la
 * page Transactions), l'activité pédagogique au score brut, le compte, les
 * communications.
 */
export const UserFileClient = ({
  file,
  bans,
  products,
  currentUserId,
  initialNow,
}: {
  file: UserFile
  bans: UserBanView[]
  products: ProductView[]
  currentUserId: string
  initialNow: number
}) => {
  const [granting, setGranting] = useState(false)
  const u = file.user
  const label = userLabel(u.name)

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="text-ink-3 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              href="/admin/utilisateurs"
              className="focus-ring hover:text-ink rounded-xs"
            >
              Utilisateurs
            </Link>
          </li>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <li aria-current="page" className="text-ink">
            {label}
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center gap-3.5">
        <UserAvatar name={label} image={u.image} className="size-14" />
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
          <h1
            className={cn(
              "type-h2 text-ink wrap-anywhere",
              !u.name.trim() && "italic",
            )}
          >
            {label}
            {u.id === currentUserId && (
              <span className="text-ink-3 ml-2.5 font-sans text-sm font-medium not-italic">
                (vous)
              </span>
            )}
          </h1>
          <span className="text-ink-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
            {u.username ? (
              <span className="font-mono">@{u.username}</span>
            ) : (
              <Muted>sans nom d&apos;utilisateur</Muted>
            )}
            <span className="wrap-anywhere">{u.email}</span>
            <StatusPill tone="neutral">
              {u.role === "admin" ? "Administrateur" : "Étudiant"}
            </StatusPill>
            {u.banned && <BannedPill />}
          </span>
        </div>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section eyebrow="Accès" title="Abonnements">
          <AccessBlock
            file={file}
            now={initialNow}
            onGrant={() => setGranting(true)}
          />
        </Section>
        <Section eyebrow="Paiements" title="Résumé">
          <PaymentsBlock file={file} />
        </Section>
      </div>

      <Section eyebrow="Activité pédagogique" title="Examens blancs et séries">
        <Activity file={file} now={initialNow} />
      </Section>

      <Section eyebrow="Compte" title="Identité, rôle et suspension">
        <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
          <Identity file={file} />
          <div className="flex min-w-0 flex-col gap-5">
            <UserRoleSection user={u} currentUserId={currentUserId} />
            <UserBanSection
              user={u}
              bans={bans}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Communications"
        title="Préférences et courriels envoyés"
      >
        <Communications file={file} />
      </Section>

      <ManualPaymentFlow
        open={granting}
        onOpenChange={setGranting}
        products={products}
        client={{ id: u.id, label: u.name.trim() || u.email }}
        viewLabel="Voir le dossier de paiement"
      />
    </>
  )
}
