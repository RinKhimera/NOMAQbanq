import { CheckCircle, Edit, Eye, Plus, Target, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Doc } from "@/convex/_generated/dataModel"

type QuestionCardProps = {
  question: Doc<"questions">
  onEdit?: () => void
  onDelete?: () => void
  onAdd?: () => void
  onViewDetails?: () => void
  showActions?: boolean
}

const QuestionCard = ({
  question,
  onEdit,
  onDelete,
  onAdd,
  onViewDetails,
  showActions = true,
}: QuestionCardProps) => {
  return (
    <Card className="@container">
      <CardContent>
        <div className="flex flex-col gap-4 @[50rem]:flex-row @[50rem]:items-start">
          {/* Contenu principal */}
          <div className="flex-1 space-y-2">
            <Badge variant="default">{question.domain}</Badge>

            <p className="line-clamp-5 font-medium">{question.question}</p>

            <div className="flex flex-col gap-2 text-sm text-gray-600 @[400px]:flex-row @[400px]:items-center @[400px]:justify-between dark:text-gray-300">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <Target className="h-4 w-4 flex-shrink-0" />
                <Badge variant="outline" className="max-w-[400px]">
                  {question.objectifCMC}
                </Badge>
              </div>

              {question.references && (
                <div className="flex flex-shrink-0 items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <Badge variant="outline" className="whitespace-nowrap">
                    {question.references.length} réf.
                  </Badge>
                </div>
              )}
            </div>

            {/* Options de réponse */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {question.options.map((option, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 rounded-lg p-2 text-sm ${
                    option === question.correctAnswer
                      ? "border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
                      : "bg-muted dark:bg-muted/50"
                  }`}
                >
                  <Badge
                    variant={
                      option === question.correctAnswer ? "default" : "outline"
                    }
                    className="flex h-6 min-w-[24px] items-center justify-center"
                  >
                    {String.fromCharCode(65 + index)}
                  </Badge>
                  <span
                    className={`truncate ${
                      option === question.correctAnswer ? "font-medium" : ""
                    }`}
                  >
                    {option}
                  </span>
                  {option === question.correctAnswer && (
                    <CheckCircle className="ml-auto h-4 w-4 flex-shrink-0 text-blue-600" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex gap-2 @[50rem]:flex-col">
              {onViewDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 @max-[50rem]:flex-1"
                  onClick={onViewDetails}
                >
                  <Eye className="h-4 w-4" />
                  Voir
                </Button>
              )}

              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 @max-[50rem]:flex-1"
                  onClick={onEdit}
                >
                  <Edit className="h-4 w-4" />
                  Éditer
                </Button>
              )}

              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive/80 flex items-center gap-1 @max-[50rem]:flex-1"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </Button>
              )}

              {onAdd && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 text-green-600 hover:text-green-700 @max-[50rem]:flex-1"
                  onClick={onAdd}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default QuestionCard
