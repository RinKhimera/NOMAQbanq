"use client"

import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  RotateCcw,
} from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { type ReactNode, useEffect, useRef, useState } from "react"
import {
  AccessBadge,
  getAccessStatus,
} from "@/components/shared/payments/access-badge"
import { StatusCard } from "@/components/shared/status-card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { AccessType } from "@/features/payments/access-ledger"
import {
  type VerifyCheckoutResult,
  verifyStripeCheckout,
} from "@/features/payments/actions"
import { formatCurrency, formatExpiration } from "@/lib/format"
import { callAction } from "@/lib/safe-action"
import { TOUCH_TARGET } from "@/lib/touch-target"
import { cn } from "@/lib/utils"

const DAY_MS = 24 * 60 * 60 * 1000
const POLL_INTERVAL_MS = 2000
/** Relectures automatiques avant de rendre la main à « Vérifier à nouveau ». */
const MAX_POLLS = { activation: 5, pending: 3 }

type GrantedAccess = {
  type: AccessType
  expiresAt: number
  daysRemaining: number
}

type Receipt = {
  productName: string | null
  amount: string | null
  customerEmail: string | null
  promo: boolean
}

type View =
  | { kind: "verifying" }
  | { kind: "paid"; receipt: Receipt; access: GrantedAccess[] | null }
  | { kind: "pending" }
  | { kind: "refunded" }
  | { kind: "failed" }
  | { kind: "error" }

const toView = (res: VerifyCheckoutResult, now: number): View => {
  if (!res.success) return { kind: "error" }
  const purchase = res.purchase
  // Lu avant `payment_status` : un paiement différé échoué ou une session
  // expirée restent `unpaid` chez Stripe, seule la transaction dit l'issue.
  if (purchase?.status === "refunded") return { kind: "refunded" }
  if (purchase?.status === "failed") return { kind: "failed" }
  if (res.status === "unpaid") return { kind: "pending" }
  if (res.status !== "paid" && res.status !== "no_payment_required") {
    return { kind: "error" }
  }
  // Un paiement unique couvert à 100 % par un code promo arrive `paid` avec un
  // total nul, pas `no_payment_required` : aucun PaymentIntent, donc aucun reçu.
  const promo = res.amountTotal === 0
  return {
    kind: "paid",
    receipt: {
      productName: purchase?.productName ?? null,
      amount:
        res.amountTotal == null
          ? null
          : formatCurrency(res.amountTotal, res.currency?.toUpperCase()),
      customerEmail: promo ? null : res.customerEmail,
      promo,
    },
    access:
      purchase?.status === "completed"
        ? purchase.access.map((a) => ({
            ...a,
            daysRemaining: Math.ceil((a.expiresAt - now) / DAY_MS),
          }))
        : null,
  }
}

const isWaiting = (view: View) =>
  view.kind === "pending" || (view.kind === "paid" && view.access === null)

const pollLimit = (view: View) =>
  view.kind === "pending" ? MAX_POLLS.pending : MAX_POLLS.activation

const TAB_TITLE: Record<View["kind"], string> = {
  verifying: "Vérification du paiement",
  paid: "Paiement réussi",
  pending: "Paiement en attente",
  refunded: "Paiement remboursé",
  failed: "Paiement non abouti",
  error: "Erreur de paiement",
}

export const PaymentSuccessContent = ({
  supportEmail,
}: {
  supportEmail: string
}) => {
  const sessionId = useSearchParams().get("session_id")
  const [view, setView] = useState<View>(() =>
    sessionId ? { kind: "verifying" } : { kind: "error" },
  )
  // `round` relance une série de relectures (« Vérifier à nouveau ») ;
  // `attempt` compte les relectures automatiques de la série.
  const [poll, setPoll] = useState({ round: 0, attempt: 0 })
  const [rechecking, setRechecking] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  // La carte qui suit un clic sur « Vérifier à nouveau » prend le focus : le
  // bouton cliqué disparaît avec l'ancienne.
  const [rechecked, setRechecked] = useState(false)
  const shown = useRef<View | null>(null)

  useEffect(() => {
    document.title = `${TAB_TITLE[view.kind]} | NOMAQbanq`
  }, [view.kind])

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    void callAction(() => verifyStripeCheckout(sessionId)).then((res) => {
      if (cancelled) return
      const next = toView(res, Date.now())
      setRechecking(false)
      // Un échec de relecture (réseau, Stripe) ne remplace pas un résultat
      // déjà montré : on rend la main à « Vérifier à nouveau ».
      if (next.kind === "error" && shown.current && isWaiting(shown.current)) {
        setExhausted(true)
        return
      }
      shown.current = next
      setView(next)
      const again = isWaiting(next) && poll.attempt < pollLimit(next)
      setExhausted(isWaiting(next) && !again)
      if (again) {
        timer = setTimeout(
          () => setPoll((p) => ({ ...p, attempt: p.attempt + 1 })),
          POLL_INTERVAL_MS,
        )
      }
    })

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sessionId, poll])

  const recheck = () => {
    setRechecking(true)
    setRechecked(true)
    setPoll((p) => ({ round: p.round + 1, attempt: 0 }))
  }

  const support = (
    <a href={`mailto:${supportEmail}`} className="text-accent-ink underline">
      {supportEmail}
    </a>
  )

  return (
    <div className="grid min-h-[min(70vh,680px)] place-items-center py-6">
      <p role="status" className="sr-only">
        {view.kind === "verifying" ? "" : TAB_TITLE[view.kind]}
      </p>
      {view.kind === "verifying" && (
        <StatusCard busy label="Paiement" title="Vérification du paiement…">
          <p className="text-ink-2 text-[15px] leading-relaxed">
            Nous confirmons votre paiement auprès de Stripe. Cela prend quelques
            secondes.
          </p>
        </StatusCard>
      )}

      {view.kind === "paid" && (
        <StatusCard
          key={view.access ? "granted" : "activation"}
          focusTitle={rechecked}
          icon={CircleCheck}
          iconTone="success"
          label={view.receipt.promo ? "Code promo" : "Paiement"}
          title="Paiement réussi"
          actions={
            <>
              <Button asChild>
                <Link href="/tableau-de-bord">
                  Aller au tableau de bord
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/tableau-de-bord/abonnements">
                  Voir mes abonnements
                </Link>
              </Button>
            </>
          }
          help={
            <>Une question sur ce paiement&nbsp;? Écrivez-nous à {support}.</>
          }
        >
          <ReceiptBox receipt={view.receipt} />
          {view.access ? (
            <AccessList access={view.access} />
          ) : (
            <div className="bg-surface-2 border-line flex flex-wrap items-center gap-2.5 rounded-md border px-3.5 py-3">
              <Spinner size="sm" className="text-ink-3" />
              <span className="text-ink text-sm">
                Activation de votre accès…
              </span>
              {exhausted && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn("ml-auto", TOUCH_TARGET)}
                  disabled={rechecking}
                  onClick={recheck}
                >
                  Vérifier à nouveau
                </Button>
              )}
            </div>
          )}
        </StatusCard>
      )}

      {view.kind === "pending" && (
        <StatusCard
          focusTitle={rechecked}
          icon={Clock}
          iconTone="warning"
          label="En attente"
          title="Paiement en cours de confirmation"
          actions={
            <>
              <Button disabled={rechecking} onClick={recheck}>
                {rechecking ? <Spinner size="sm" /> : <RotateCcw aria-hidden />}
                Vérifier à nouveau
              </Button>
              <Button asChild variant="outline">
                <Link href="/tableau-de-bord">Retour au tableau de bord</Link>
              </Button>
            </>
          }
          help={
            <>Une question sur ce paiement&nbsp;? Écrivez-nous à {support}.</>
          }
        >
          <Prose>
            <p>
              Le paiement n&apos;est pas encore confirmé. Votre accès sera
              activé dès la confirmation.
            </p>
            <p>
              Vous pouvez quitter cette page&nbsp;: vous recevrez votre accès
              sans avoir à revenir ici.
            </p>
          </Prose>
        </StatusCard>
      )}

      {view.kind === "refunded" && (
        <StatusCard
          focusTitle={rechecked}
          icon={RotateCcw}
          label="Remboursement"
          title="Ce paiement a été remboursé"
          actions={
            <>
              <Button asChild>
                <Link href="/tarifs">Voir les tarifs</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/tableau-de-bord">Retour au tableau de bord</Link>
              </Button>
            </>
          }
          help={
            <>
              Une question sur ce remboursement&nbsp;? Écrivez-nous à {support}.
            </>
          }
        >
          <Prose>
            <p>L&apos;accès lié à cet achat a été retiré.</p>
          </Prose>
        </StatusCard>
      )}

      {view.kind === "failed" && (
        <StatusCard
          focusTitle={rechecked}
          icon={CircleX}
          iconTone="danger"
          label="Paiement"
          title="Ce paiement n'a pas abouti"
          actions={
            <>
              <Button asChild>
                <Link href="/tarifs">Retour aux tarifs</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/tableau-de-bord">Retour au tableau de bord</Link>
              </Button>
            </>
          }
          help={
            <>Une question sur ce paiement&nbsp;? Écrivez-nous à {support}.</>
          }
        >
          <Prose>
            <p>
              Aucun accès n&apos;a été activé. Vous pouvez réessayer depuis la
              page des tarifs.
            </p>
          </Prose>
        </StatusCard>
      )}

      {view.kind === "error" && (
        <StatusCard
          focusTitle={rechecked}
          icon={CircleAlert}
          iconTone="danger"
          label="Erreur"
          title="Impossible de vérifier ce paiement"
          actions={
            <>
              <Button asChild>
                <Link href="/tarifs">Retour aux tarifs</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/tableau-de-bord">Retour au tableau de bord</Link>
              </Button>
            </>
          }
          help={<>Le problème persiste&nbsp;? Écrivez-nous à {support}.</>}
        >
          <Prose>
            <p>
              Si un montant a été débité, votre accès sera activé quand même.
              Sinon, vous pouvez réessayer depuis la page des tarifs.
            </p>
          </Prose>
        </StatusCard>
      )}
    </div>
  )
}

const Prose = ({ children }: { children: ReactNode }) => (
  <div className="text-ink-2 flex flex-col gap-2.5 text-[15px] leading-relaxed">
    {children}
  </div>
)

const ReceiptBox = ({ receipt }: { receipt: Receipt }) => (
  <div className="bg-surface-2 border-line flex flex-col gap-2 rounded-md border px-4 py-3.5">
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <span className="text-ink text-[15px] font-semibold">
        {receipt.productName ?? "Votre achat"}
      </span>
      {receipt.amount && (
        <span className="text-ink font-mono text-[15px]">{receipt.amount}</span>
      )}
    </div>
    {receipt.promo && (
      <span className="text-ink-3 font-mono text-[13px]">
        Code promo appliqué (−100 %)
      </span>
    )}
    {receipt.customerEmail && (
      <span className="text-ink-2 text-[13px] wrap-anywhere">
        Reçu envoyé à <span className="text-ink">{receipt.customerEmail}</span>
      </span>
    )}
  </div>
)

const AccessList = ({ access }: { access: GrantedAccess[] }) => {
  const label = access.length > 1 ? "Accès activés" : "Accès activé"
  return (
    <div className="flex flex-col gap-2">
      <span className="type-label" aria-hidden>
        {label}
      </span>
      <ul
        aria-label={label}
        className="border-line bg-surface divide-line divide-y rounded-md border"
      >
        {access.map((a) => (
          <li
            key={a.type}
            className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3"
          >
            <AccessBadge
              accessType={a.type}
              status={getAccessStatus(a.expiresAt, a.daysRemaining)}
              daysRemaining={a.daysRemaining}
              showDetails
              size="sm"
            />
            <span className="text-ink-2 text-[13px]">
              Expire le{" "}
              <span className="text-ink font-medium">
                {formatExpiration(a.expiresAt)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
