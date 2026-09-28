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
        className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
      />
    ) : (
      <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
