import { EmailButton } from "../components/email-button"
import { EmailFallbackLink } from "../components/email-fallback-link"
import { EmailParagraph } from "../components/email-paragraph"
import { EmailRecap } from "../components/email-recap"
import { EmailLayout } from "./email-layout"

const DETAIL = "Le détail de chaque question est consultable dans votre espace."

export const examResultsTitle = "Vos résultats sont disponibles"

export function ExamResultsEmail({
  examTitle,
  score,
  resultUrl,
  firstName,
  baseUrl,
}: {
  examTitle: string
  /** `null` = score retenu (correction différée) : la page seule le dira. */
  score: number | null
  resultUrl: string
  firstName: string | null
  baseUrl: string
}) {
  const scoreLabel = score === null ? null : `${score} %`
  return (
    <EmailLayout
      category="transactional"
      preview={scoreLabel ? `Score : ${scoreLabel}. ${DETAIL}` : DETAIL}
      heading={examResultsTitle}
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
          ...(scoreLabel
            ? [{ label: "Score", value: scoreLabel, mono: true }]
            : []),
        ]}
      />
      {/* Aucune date : le score reste retenu tant qu'une de ses questions
          figure dans un autre examen encore ouvert. */}
      {scoreLabel ? null : (
        <EmailParagraph muted style={{ margin: "-8px 0 16px" }}>
          Votre score sera affiché sur la page de résultats dès qu&apos;il sera
          disponible.
        </EmailParagraph>
      )}
      <EmailButton href={resultUrl}>Voir mes résultats</EmailButton>
      <EmailFallbackLink href={resultUrl} />
    </EmailLayout>
  )
}
