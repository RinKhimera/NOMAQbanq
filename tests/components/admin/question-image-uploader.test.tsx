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

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Envoi en cours",
    )
  })
})
