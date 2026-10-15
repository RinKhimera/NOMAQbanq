import { Star } from "lucide-react"
import { UserAvatar } from "@/components/shared/user-avatar"
import { testimonials } from "@/data/testimonials"
import { cn } from "@/lib/utils"

type StarsProps = { rating?: number; className?: string }

export const Stars = ({ rating = 5, className }: StarsProps) => (
  <span
    role="img"
    aria-label={`${rating} sur 5`}
    className={cn("inline-flex gap-0.5", className)}
  >
    {[0, 1, 2, 3, 4].map((i) => (
      <Star
        key={i}
        aria-hidden
        className={cn(
          "size-3.5",
          i < rating ? "fill-warning text-warning" : "text-line-strong",
        )}
      />
    ))}
  </span>
)

/** Preuve sociale : avatars des témoignages, nombre de candidats. */
export const ProofLine = ({ totalUsers }: { totalUsers: string }) => (
  <div className="flex flex-wrap items-center gap-3.5">
    <div className="flex">
      {testimonials.map((t, i) => (
        <UserAvatar
          key={t.id}
          name={t.name}
          image={null}
          className={cn("ring-background size-8 ring-2", i > 0 && "-ml-2")}
          fallbackClassName="bg-surface-2 text-ink-2 text-xs font-medium"
        />
      ))}
    </div>
    <span className="text-ink-3 text-[13px]">
      {totalUsers} candidats inscrits
    </span>
  </div>
)
