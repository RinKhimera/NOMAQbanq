import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CalculatorProvider, useCalculator } from "@/hooks/useCalculator"

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CalculatorProvider>{children}</CalculatorProvider>
)

type Calculator = ReturnType<typeof useCalculator>

const OPERATORS = ["+", "-", "*", "/"] as const
type Operator = (typeof OPERATORS)[number]
const isOperator = (key: string): key is Operator =>
  (OPERATORS as readonly string[]).includes(key)

const pressKey = (calc: Calculator, key: string) => {
  if (key === "=") calc.calculate()
  else if (key === ".") calc.inputDecimal()
  else if (key === "C") calc.clear()
  else if (key === "⌫") calc.backspace()
  else if (isOperator(key)) calc.inputOperator(key)
  else calc.inputNumber(key)
}

/**
 * Une touche par `act` : dans un même `act`, chaque appel lirait l'état du
 * rendu précédent (fermeture périmée) et la séquence ne serait pas celle tapée.
 */
const press = (result: { current: Calculator }, keys: string) => {
  for (const key of keys.split(" ")) {
    act(() => pressKey(result.current, key))
  }
}

const setup = (keys?: string) => {
  const { result } = renderHook(() => useCalculator(), { wrapper })
  if (keys) press(result, keys)
  return result
}

describe("useCalculator", () => {
  it("démarre sur 0, sans opération en attente", () => {
    const result = setup()
    expect(result.current.display).toBe("0")
    expect(result.current.operation).toBeNull()
    expect(result.current.previousValue).toBeNull()
  })

  it("remplace le 0 initial par le premier chiffre", () => {
    expect(setup("7").current.display).toBe("7")
  })

  it("C remet tout à zéro, opération en attente comprise", () => {
    const result = setup("5 + 3 C")
    expect(result.current.display).toBe("0")
    expect(result.current.previousValue).toBeNull()
    expect(result.current.operation).toBeNull()
  })

  it.each([
    ["3 . 1", "3.1"],
    ["3 . . 1", "3.1"],
    ["5 + .", "0."],
  ])("virgule : %s → %s", (keys, display) => {
    expect(setup(keys).current.display).toBe(display)
  })

  it.each([
    ["1 2 ⌫", "1"],
    ["5 ⌫", "0"],
    ["1 2 + ⌫", "0"],
    ["1 0 - 2 5 = ⌫", "0"],
  ])("retour arrière : %s → %s", (keys, display) => {
    expect(setup(keys).current.display).toBe(display)
  })

  it.each([
    ["2 + 3 =", "5"],
    ["1 0 - 4 =", "6"],
    ["6 * 7 =", "42"],
    ["2 0 / 5 =", "4"],
  ])("%s → %s", (keys, display) => {
    expect(setup(keys).current.display).toBe(display)
  })

  it("enchaîne un calcul sur le résultat précédent", () => {
    const result = setup("5 + 3 =")
    expect(result.current.display).toBe("8")
    press(result, "- 2 =")
    expect(result.current.display).toBe("6")
  })

  it("un second opérateur remplace le premier sans calculer", () => {
    const result = setup("5 + -")
    expect(result.current.previousValue).toBe(5)
    expect(result.current.operation).toBe("-")
  })

  it("= sans opération en attente ne change rien", () => {
    expect(setup("5 =").current.display).toBe("5")
  })

  it("plafonne la saisie à 12 chiffres", () => {
    expect(setup("1 2 3 4 5 6 7 8 9 0 1 2 3").current.display).toBe(
      "123456789012",
    )
  })

  describe("division par zéro", () => {
    it("affiche Erreur et oublie l'opération", () => {
      const result = setup("5 / 0 =")
      expect(result.current.display).toBe("Erreur")
      expect(result.current.previousValue).toBeNull()
      expect(result.current.operation).toBeNull()
    })

    it.each([
      ["3", "3"],
      [".", "0."],
      ["⌫", "0"],
    ])("après Erreur, %s repart de zéro → %s", (key, display) => {
      expect(setup(`5 / 0 = ${key}`).current.display).toBe(display)
    })

    it("après Erreur, un opérateur est ignoré", () => {
      const result = setup("5 / 0 = +")
      expect(result.current.display).toBe("Erreur")
      expect(result.current.operation).toBeNull()
    })

    it("= ne change rien quand l'erreur vient d'un opérateur enchaîné", () => {
      // « 5 / 0 + » calcule la division au moment de l'opérateur : l'affichage
      // passe à Erreur alors qu'une opération reste en attente.
      const result = setup("5 / 0 +")
      expect(result.current.display).toBe("Erreur")
      const before = { ...result.current }
      press(result, "=")
      expect(result.current).toMatchObject({
        display: before.display,
        previousValue: before.previousValue,
        operation: before.operation,
      })
    })
  })
})
