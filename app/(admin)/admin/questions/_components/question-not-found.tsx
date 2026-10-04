import { FileQuestion } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

/** Question introuvable ou supprimée, depuis son détail ou `/modifier`. */
export const QuestionNotFound = ({ listHref }: { listHref: string }) => (
  <div className="flex flex-col gap-4 p-4 lg:p-6">
    <nav aria-label="Fil d'Ariane" className="text-ink-3 text-sm">
      <Link href={listHref} className="hover:text-ink">
        Questions
      </Link>{" "}
      › <span className="text-ink">Introuvable</span>
    </nav>
    <div className="bg-surface border-line rounded-lg border py-12">
      <EmptyState
        size="compact"
        icons={[FileQuestion]}
        title="Question introuvable"
        description="Cette question n'existe pas ou a été supprimée."
      >
        <Button asChild variant="outline">
          <Link href={listHref}>Retour aux questions</Link>
        </Button>
      </EmptyState>
    </div>
  </div>
)
