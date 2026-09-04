import { EmailButton } from "../components/email-button"
import { EmailFallbackLink } from "../components/email-fallback-link"
import { EmailParagraph } from "../components/email-paragraph"
import { EmailRecap } from "../components/email-recap"
import { EmailLayout } from "./email-layout"

export function ExamResultsEmail({
  examTitle,
  score,
  resultUrl,
  firstName,
  baseUrl,
}: {
  examTitle: string
  score: number
  resultUrl: string
  firstName: string | null
  baseUrl: string
}) {
  return (
    <EmailLayout
      category="transactional"
      preview={`Vos résultats pour ${examTitle} sont disponibles`}
      heading="Vos résultats sont disponibles"
      firstName={firstName}
      baseUrl={baseUrl}
    >
      <EmailParagraph>
        Les résultats de votre examen blanc sont maintenant consultables, avec
        le détail de chaque question.
      </EmailParagraph>
      <EmailRecap
        rows={[
          { label: "Examen", value: examTitle },
          { label: "Score", value: `${score} %` },
        ]}
      />
      <EmailButton href={resultUrl}>Voir mes résultats</EmailButton>
      <EmailFallbackLink href={resultUrl} />
    </EmailLayout>
  )
}
