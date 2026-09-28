import { Search } from "lucide-react"
import type { ComponentProps } from "react"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type SearchInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  value: string
  onValueChange: (value: string) => void
  /** Rechargement en cours : l'icône cède la place au spinner. */
  isSearching?: boolean
  containerClassName?: string
}

export const SearchInput = ({
  value,
  onValueChange,
  isSearching = false,
  placeholder,
  className,
  containerClassName,
  ...props
}: SearchInputProps) => (
  <div className={cn("relative", containerClassName)}>
    {isSearching ? (
      <Spinner
        size="sm"
        className="text-ink-3 absolute top-1/2 left-3 -translate-y-1/2"
      />
    ) : (
      <Search
        className="text-ink-3 absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
    )}
    <Input
      type="text"
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      className={cn("pl-10", className)}
      {...props}
    />
  </div>
)
