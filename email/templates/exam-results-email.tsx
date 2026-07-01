import { Button, Link, Section, Text } from "@react-email/components"
import { EmailLayout } from "./email-layout"

export function ExamResultsEmail({
  examTitle,
  score,
  resultUrl,
}: {
  examTitle: string
  score: number
  resultUrl: string
}) {
  return (
    <EmailLayout preview={`Vos résultats pour ${examTitle} sont disponibles`}>
      <Section>
        <Text style={{ fontSize: "16px", color: "#18181b" }}>
          Vos résultats pour <strong>{examTitle}</strong> sont maintenant
          disponibles. Score : <strong>{score}%</strong>.
        </Text>
        <Button
          href={resultUrl}
          style={{
            backgroundColor: "#18181b",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "6px",
            fontSize: "14px",
            display: "inline-block",
          }}
        >
          Voir mes résultats
        </Button>
        <Text style={{ fontSize: "13px", color: "#52525b" }}>
          Ou copiez ce lien : <Link href={resultUrl}>{resultUrl}</Link>
        </Text>
      </Section>
    </EmailLayout>
  )
}
