import { describe, expect, it } from "vitest"
import {
  examDuration,
  firstFailingStep,
  fromLocalDay,
  reopeningTitle,
  toLocalDay,
  windowNote,
} from "@/app/(admin)/admin/examens/_components/exam-form-model"

describe("modèle du formulaire d'examen", () => {
  it("la note de fenêtre compte les jours, fin exclusive", () => {
    expect(windowNote("2026-11-06", "2026-11-09")).toBe(
      "Ouvert 3 jours : du 6 nov. 0 h 00 au 9 nov. 0 h 00",
    )
    expect(windowNote("2026-10-31", "2026-11-01")).toBe(
      "Ouvert 1 jour : du 31 oct. 0 h 00 au 1er nov. 0 h 00",
    )
  })

  it("un jour choisi vaut minuit du navigateur, aller-retour exact", () => {
    const ms = fromLocalDay("2026-11-06")
    expect(ms).not.toBeNull()
    expect(new Date(ms!).getHours()).toBe(0)
    expect(toLocalDay(ms!)).toBe("2026-11-06")
    expect(fromLocalDay("")).toBeNull()
  })

  it("la première étape fautive suit l'ordre de la page", () => {
    expect(
      firstFailingStep({
        questionIds: "x",
        audienceUserIds: "y",
        endDate: "z",
      }),
    ).toBe("window")
    expect(firstFailingStep({})).toBeNull()
  })

  it("durée à 83 s par question, titre de réouverture sans suffixe répété", () => {
    expect(examDuration(230)).toBe("5 h 18")
    expect(reopeningTitle("EB-25 (réouverture)")).toBe("EB-25 (réouverture)")
  })
})
