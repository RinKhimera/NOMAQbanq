import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
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
  it("refuse d'être appelé hors de CalculatorProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => renderHook(() => useCalculator())).toThrow(
      "useCalculator must be used within CalculatorProvider",
    )
  })

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

  describe("chaîne d'opérations, de gauche à droite", () => {
    it.each([
      ["2 + 3 *", "5", "4 =", "20", 5, "*"],
      ["1 0 - 4 -", "6", "3 =", "3", 6, "-"],
      ["8 / 2 *", "4", "3 =", "12", 4, "*"],
    ] as const)(
      "%s affiche %s, puis %s → %s",
      (keys, partial, rest, total, previousValue, operation) => {
        const result = setup(keys)
        expect(result.current).toMatchObject({
          display: partial,
          previousValue,
          operation,
        })
        press(result, rest)
        expect(result.current.display).toBe(total)
      },
    )

    it("garde la valeur exacte derrière l'affichage arrondi", () => {
      const result = setup("1 / 3 +")
      expect(result.current.display).toBe("0.3333333333")
      expect(result.current.previousValue).toBe(1 / 3)
    })

    it.each([
      ["1 / 3 * 3 =", "1"],
      ["1 / 3 = * 3 =", "1"],
      ["9 9 9 9 9 9 9 9 9 9 9 9 * 2 / 2 =", "999999999999"],
    ])("%s → %s : l'arrondi de l'écran ne se propage pas", (keys, total) => {
      expect(setup(keys).current.display).toBe(total)
    })
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

  it("passe en notation scientifique au-delà de 10¹²", () => {
    expect(setup("9 9 9 9 9 9 9 9 9 9 9 9 * 2 =").current.display).toBe(
      "2.00e+12",
    )
  })

  it("plafonne la saisie à 12 chiffres", () => {
    expect(setup("1 2 3 4 5 6 7 8 9 0 1 2 3").current.display).toBe(
      "123456789012",
    )
  })

  describe("division par zéro", () => {
    it.each(["5 / 0 =", "0 / 0 ="])(
      "%s affiche Erreur et oublie l'opération",
      (keys) => {
        const result = setup(keys)
        expect(result.current.display).toBe("Erreur")
        expect(result.current.previousValue).toBeNull()
        expect(result.current.operation).toBeNull()
      },
    )

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

    it("au milieu d'une chaîne, affiche Erreur et abandonne la chaîne", () => {
      const result = setup("5 / 0 +")
      expect(result.current).toMatchObject({
        display: "Erreur",
        previousValue: null,
        operation: null,
      })
      press(result, "=")
      expect(result.current.display).toBe("Erreur")
      press(result, "4 * 2 =")
      expect(result.current.display).toBe("8")
    })
  })
})
