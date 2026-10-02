import { Image as ImageIcon, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"
import type { BankQuestion } from "@/features/questions/dal"
import { cn } from "@/lib/utils"

/** Ligne de la banque ou de la sélection : énoncé cliquable, méta, action. */
export const ComposerRow = ({
  q,
  onPreview,
  meta,
  action,
  testId,
}: {
  q: BankQuestion
  onPreview: (q: BankQuestion) => void
  meta?: ReactNode
  action?: ReactNode
  testId: string
}) => (
  <li
    data-testid={testId}
    data-question-id={q.id}
    className="border-line grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 border-t px-3.5 py-2.5 max-md:grid-cols-1"
  >
    <div className="flex min-w-0 flex-col gap-1.5">
      <button
        type="button"
        onClick={() => onPreview(q)}
        data-testid="composer-question-preview"
        className="focus-ring text-ink flex cursor-pointer items-start gap-1.5 rounded-xs text-left text-[0.8125rem] leading-[1.45] hover:underline hover:decoration-(--line-strong) hover:underline-offset-3"
      >
        {q.keyToVerify && (
          <TriangleAlert
            role="img"
            aria-label="Clé à vérifier"
            className="text-warning mt-0.75 size-3.5 shrink-0"
          />
        )}
        {q.imageCount > 0 && (
          <ImageIcon
            role="img"
            aria-label="Image d'énoncé"
            className="text-ink-3 mt-0.75 size-3.5 shrink-0"
          />
        )}
        <span className="line-clamp-2">{q.question.replace(/\n/g, " ")}</span>
      </button>
      {meta && (
        <span className="text-ink-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          {meta}
        </span>
      )}
    </div>
    {action && <div className="max-md:justify-self-start">{action}</div>}
  </li>
)

/** Pastille mono de la dernière utilisation, ambre quand la question est récente. */
export const LastUseTag = ({
  label,
  recent,
}: {
  label: string | null
  recent: boolean
}) => (
  <span
    className={cn(
      "inline-flex h-5 items-center rounded-xs border px-1.5 font-mono text-[11px] whitespace-nowrap",
      recent
        ? "border-warning-line text-warning-ink"
        : "border-line text-ink-2",
    )}
  >
    {label ?? "—"}
  </span>
)
