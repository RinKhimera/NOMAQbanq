import { describe, expect, it } from "vitest"
import { planCompletion } from "@/features/exams/completion"

const supply = (
  domain: string,
  available: number,
  clean = available,
  recent = 0,
) => ({ domain, available, clean, recent })

const byDomain = (draws: ReturnType<typeof planCompletion>) =>
  Object.fromEntries(draws.map((d) => [d.domain, [d.clean, d.fallback]]))

describe("planCompletion — répartition comme la banque", () => {
  it("répartit au prorata des questions disponibles de chaque domaine", () => {
    // 60 / 30 / 10 % de la banque, 20 questions à compléter.
    const draws = planCompletion(
      [
        supply("Cardiologie", 300),
        supply("Pédiatrie", 150),
        supply("Psychiatrie", 50),
      ],
      20,
    )
    expect(byDomain(draws)).toEqual({
      Cardiologie: [12, 0],
      Pédiatrie: [6, 0],
      Psychiatrie: [2, 0],
    })
  })

  it("donne les places restantes aux plus forts restes, pour un total exact", () => {
    // Quotas bruts 3,33 / 3,33 / 3,33 : un domaine reçoit la dixième place.
    const draws = planCompletion(
      [supply("A", 100), supply("B", 100), supply("C", 100)],
      10,
    )
    expect(draws.reduce((n, d) => n + d.clean + d.fallback, 0)).toBe(10)
  })

  it("complète par des questions récentes quand un domaine manque d'anciennes, et le signale", () => {
    // Pédiatrie : 6 places, 2 anciennes seulement, 10 récentes.
    const draws = planCompletion(
      [supply("Cardiologie", 120), supply("Pédiatrie", 60, 2, 10)],
      18,
    )
    expect(byDomain(draws)).toEqual({
      Cardiologie: [12, 0],
      Pédiatrie: [2, 4],
    })
  })

  it("reporte sur les autres domaines ce qu'un domaine ne peut pas fournir du tout", () => {
    // Pédiatrie : 5 places, mais 1 question utilisable (les autres sont des clés à vérifier).
    const draws = planCompletion(
      [supply("Cardiologie", 50), supply("Pédiatrie", 50, 1, 0)],
      10,
    )
    expect(byDomain(draws)).toEqual({
      Cardiologie: [9, 0],
      Pédiatrie: [1, 0],
    })
  })

  it("ne propose jamais plus que la banque utilisable", () => {
    const draws = planCompletion([supply("A", 10, 3, 2)], 20)
    expect(byDomain(draws)).toEqual({ A: [3, 2] })
  })

  it("ne propose rien sans place à remplir ou sans banque", () => {
    expect(planCompletion([supply("A", 10)], 0)).toEqual([])
    expect(planCompletion([], 5)).toEqual([])
  })
})
