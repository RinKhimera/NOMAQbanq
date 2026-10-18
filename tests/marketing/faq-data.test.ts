import { describe, expect, it } from "vitest"
import { GUIDE_SECTIONS } from "@/app/(marketing)/eacmc-partie-1/_data/guide"
import { faqCategories } from "@/app/(marketing)/faq/_data/faq-data"
import { MARKETING_PATHS } from "@/constants"

const examQuestions =
  faqCategories.find((c) => c.id === "eacmc")?.questions ?? []

describe("FAQ : questions sur l'EACMC", () => {
  it("existent, en tête de la FAQ", () => {
    expect(faqCategories[0].id).toBe("eacmc")
    expect(examQuestions.length).toBeGreaterThanOrEqual(4)
  })

  it("ne rappellent l'ancien nom de l'examen que dans la question qui le définit", () => {
    expect(examQuestions[0].q).toBe(
      "Qu'est-ce que l'EACMC (anciennement Partie\u00a0I) ?",
    )
    const rest = faqCategories
      .flatMap((c) => c.questions)
      .flatMap(({ q, a }) => [q, a])
      .filter((text) => text !== examQuestions[0].q)
    for (const text of rest) expect(text).not.toMatch(/partie\s(I|1)\b/i)
  })

  it.each(examQuestions.map((q) => [q.q, q.href]))(
    "« %s » renvoie à une section existante du guide",
    (_, href) => {
      const [path, anchor] = String(href).split("#")
      expect(path).toBe(MARKETING_PATHS.eacmc)
      expect(GUIDE_SECTIONS.map((s) => s.id)).toContain(anchor)
    },
  )
})
