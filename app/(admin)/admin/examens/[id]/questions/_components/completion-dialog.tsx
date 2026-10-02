"use client"

import { RefreshCw, TriangleAlert } from "lucide-react"
import { countLabel } from "@/components/admin/question-detail/labels"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export type CompletionDraw = {
  questionIds: string[]
  lines: { domain: string; count: number; fallback: number }[]
}

/**
 * Aperçu de « Compléter les N restantes » : un tirage du serveur, rien n'est
 * écrit avant « Ajouter ». Un domaine complété par des récentes est signalé.
 */
export const CompletionDialog = ({
  draw,
  need,
  redrawing,
  applying,
  onRedraw,
  onApply,
  onClose,
}: {
  draw: CompletionDraw | null
  need: number
  redrawing: boolean
  applying: boolean
  onRedraw: () => void
  onApply: (ids: string[]) => void
  onClose: () => void
}) => {
  const n = draw?.questionIds.length ?? 0
  const busy = redrawing || applying
  return (
    <Dialog open={!!draw} onOpenChange={(o) => !o && !applying && onClose()}>
      <DialogContent
        className="sm:max-w-140"
        data-testid="composer-completion-dialog"
      >
        <DialogHeader>
          <DialogTitle>Compléter les {need} restantes</DialogTitle>
          <DialogDescription>
            {n > 0
              ? `${countLabel(n, "question tirée", "questions tirées")} au hasard, réparties comme la banque, sans questions récentes ni clés à vérifier.`
              : "Aucune question à tirer : hors du jeu, la banque ne contient plus que des clés à vérifier, ou rien. Confirmez ces clés ou choisissez les questions à la main."}
          </DialogDescription>
        </DialogHeader>
        {draw && n > 0 && (
          <div className="flex flex-col gap-2.5">
            {draw.lines
              .filter((l) => l.fallback > 0)
              .map((l) => (
                <p
                  key={`w-${l.domain}`}
                  data-testid="composer-completion-fallback"
                  className="border-warning-line bg-warning-soft text-warning-ink flex items-start gap-2 rounded-md border px-2.5 py-2 text-[0.8125rem]"
                >
                  <TriangleAlert
                    aria-hidden
                    className="text-warning mt-0.5 size-3.5 shrink-0"
                  />
                  {l.domain} :{" "}
                  {countLabel(
                    l.fallback,
                    "question récente ajoutée",
                    "questions récentes ajoutées",
                  )}{" "}
                  faute d&apos;autres
                </p>
              ))}
            <div className="max-h-75 overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {draw.lines.map((l) => (
                    <tr
                      key={l.domain}
                      data-testid="composer-completion-line"
                      className={cn(l.fallback > 0 && "text-warning-ink")}
                    >
                      <td
                        className={cn(
                          "border-line w-14 border-t py-1.5 font-mono",
                          l.fallback > 0
                            ? "text-warning-ink"
                            : "text-success-ink",
                        )}
                      >
                        +{l.count}
                      </td>
                      <td className="border-line border-t py-1.5">
                        {l.domain}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onRedraw}
            className="sm:mr-auto"
            data-testid="btn-composer-redraw"
          >
            {redrawing ? <Spinner size="sm" /> : <RefreshCw aria-hidden />}
            Relancer le tirage
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={applying}
            onClick={onClose}
          >
            Annuler
          </Button>
          {n > 0 && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => draw && onApply(draw.questionIds)}
              data-testid="btn-composer-apply-completion"
            >
              {applying && <Spinner size="sm" />}
              Ajouter {countLabel(n, "question")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
