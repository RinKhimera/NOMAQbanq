import { describe, expect, it, vi } from "vitest"
import { AnswerKeyLock } from "@/features/questions/answer-key-lock"
import { groupImages, toQuizQuestion } from "@/features/questions/quiz-bridge"

vi.mock("@/db", () => ({ db: {} }))

const row = {
  questionId: "q1",
  question: "Énoncé ?",
  options: ["A", "B"],
  domain: "Cardiologie",
  objectifCMC: "Obj 1",
  correctAnswer: "A",
  explanation: "Parce que.",
  references: ["Réf"],
}
const images = [{ url: "https://cdn/x.jpg", storagePath: "x.jpg", order: 0 }]

describe("QuizBridge — toQuizQuestion", () => {
  it("sans niveau de révélation : l'énoncé seul, jamais la correction", () => {
    expect(toQuizQuestion(row, images, AnswerKeyLock.none(), null)).toEqual({
      _id: "q1",
      question: "Énoncé ?",
      options: ["A", "B"],
      domain: "Cardiologie",
      objectifCMC: "Obj 1",
      images,
    })
  })

  it("niveau « key » : la clé seule", () => {
    expect(toQuizQuestion(row, [], AnswerKeyLock.none(), "key")).toMatchObject({
      correctAnswer: "A",
    })
    expect(
      toQuizQuestion(row, [], AnswerKeyLock.none(), "key"),
    ).not.toHaveProperty("explanation")
  })

  it("niveau « correction » : clé, explication, références", () => {
    expect(
      toQuizQuestion(row, [], AnswerKeyLock.none(), "correction"),
    ).toMatchObject({
      correctAnswer: "A",
      explanation: "Parce que.",
      references: ["Réf"],
    })
  })

  it("clé retenue par le verrou : seul le marqueur, quel que soit le niveau", () => {
    const lock = AnswerKeyLock.fromIds(["q1"])
    const q = toQuizQuestion(row, images, lock, "correction-with-images")
    expect(q).toEqual({
      _id: "q1",
      question: "Énoncé ?",
      options: ["A", "B"],
      domain: "Cardiologie",
      objectifCMC: "Obj 1",
      images,
      keyWithheld: true,
    })
  })
})

describe("QuizBridge — groupImages", () => {
  it("regroupe par question avec l'URL CDN dérivée, dans l'ordre des positions", () => {
    const map = groupImages([
      { questionId: "q1", storagePath: "a/1.jpg", position: 1 },
      { questionId: "q2", storagePath: "b/0.jpg", position: 0 },
      { questionId: "q1", storagePath: "a/0.jpg", position: 0 },
    ])
    expect(map.get("q1")?.map((i) => i.order)).toEqual([1, 0])
    expect(map.get("q2")?.[0]?.url).toMatch(/^https:\/\/.+\/b\/0\.jpg$/)
  })
})
