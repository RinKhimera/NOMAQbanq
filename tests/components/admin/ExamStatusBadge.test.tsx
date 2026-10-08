import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import ExamStatusBadge from "@/components/admin/exam-status-badge"
import type { ExamStatus } from "@/lib/exam-status"

describe("ExamStatusBadge", () => {
  it.each<{ status: ExamStatus; label: string }>([
    { status: "active", label: "En cours" },
    { status: "upcoming", label: "À venir" },
    { status: "completed", label: "Terminé" },
    { status: "inactive", label: "Désactivé" },
  ])("affiche '$label' pour le statut $status", ({ status, label }) => {
    render(<ExamStatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
