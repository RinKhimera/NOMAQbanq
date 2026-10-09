import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { QuestionImageUploader } from "@/components/admin/question-image-uploader"
import { createQuestionImageUpload } from "@/features/questions/actions"

vi.mock("@/features/questions/actions", () => ({
  createQuestionImageUpload: vi.fn(),
}))

describe("QuestionImageUploader", () => {
  it("annonce l'envoi en cours d'une image au lecteur d'écran", async () => {
    vi.mocked(createQuestionImageUpload).mockReturnValue(new Promise(() => {}))
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:apercu")
    const { container } = render(
      <QuestionImageUploader
        questionId="q1"
        label="Images de l'énoncé"
        images={[]}
        onImagesChange={vi.fn()}
      />,
    )

    await userEvent.upload(
      container.querySelector<HTMLInputElement>('input[type="file"]')!,
      new File(["x"], "coeur.png", { type: "image/png" }),
    )

    // DndContext monte sa propre région « status » après coup : viser celle
    // du libellé, pas « la » région status de la page.
    const label = await screen.findByText("Envoi en cours")
    expect(label.closest('[role="status"]')).not.toBeNull()
  })
})
