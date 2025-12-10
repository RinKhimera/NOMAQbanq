import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CalculatorProvider, useCalculator } from "./useCalculator"

describe("useCalculator - Calculator Logic Tests", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CalculatorProvider>{children}</CalculatorProvider>
  )

  describe("Initial State", () => {
    it("should start with display showing 0", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })
      expect(result.current.display).toBe("0")
    })

    it("should have no operation set initially", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })
      expect(result.current.operation).toBeNull()
      expect(result.current.previousValue).toBeNull()
    })
  })

  describe("Single Digit Input", () => {
    it("should input a single digit", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("5")
      })

      expect(result.current.display).toBe("5")
    })

    it("should replace 0 with first digit", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("7")
      })

      expect(result.current.display).toBe("7")
    })
  })

  describe("Clear Function", () => {
    it("should reset calculator to 0", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("5")
      })
      act(() => {
        result.current.clear()
      })

      expect(result.current.display).toBe("0")
      expect(result.current.previousValue).toBeNull()
      expect(result.current.operation).toBeNull()
    })
  })

  describe("Decimal Input", () => {
    it("should add decimal point", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("3")
      })
      act(() => {
        result.current.inputDecimal()
      })
      act(() => {
        result.current.inputNumber("1")
      })

      expect(result.current.display).toBe("3.1")
    })

    it("should not allow multiple decimal points", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("3")
      })
      act(() => {
        result.current.inputDecimal()
      })
      act(() => {
        result.current.inputDecimal()
      })
      act(() => {
        result.current.inputNumber("1")
      })

      expect(result.current.display).toBe("3.1")
    })
  })

  describe("Backspace", () => {
    it("should remove last character", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("1")
      })
      act(() => {
        result.current.inputNumber("2")
      })
      act(() => {
        result.current.backspace()
      })

      expect(result.current.display).toBe("1")
    })

    it("should show 0 when removing last digit", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("5")
      })
      act(() => {
        result.current.backspace()
      })

      expect(result.current.display).toBe("0")
    })
  })

  describe("Addition", () => {
    it("should add 2 + 3 = 5", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("2")
      })
      act(() => {
        result.current.inputOperator("+")
      })
      act(() => {
        result.current.inputNumber("3")
      })
      act(() => {
        result.current.calculate()
      })

      expect(result.current.display).toBe("5")
    })
  })

  describe("Subtraction", () => {
    it("should subtract 10 - 4 = 6", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("1")
      })
      act(() => {
        result.current.inputNumber("0")
      })
      act(() => {
        result.current.inputOperator("-")
      })
      act(() => {
        result.current.inputNumber("4")
      })
      act(() => {
        result.current.calculate()
      })

      expect(result.current.display).toBe("6")
    })
  })

  describe("Multiplication", () => {
    it("should multiply 6 * 7 = 42", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("6")
      })
      act(() => {
        result.current.inputOperator("*")
      })
      act(() => {
        result.current.inputNumber("7")
      })
      act(() => {
        result.current.calculate()
      })

      expect(result.current.display).toBe("42")
    })
  })

  describe("Division", () => {
    it("should divide 20 / 5 = 4", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("2")
      })
      act(() => {
        result.current.inputNumber("0")
      })
      act(() => {
        result.current.inputOperator("/")
      })
      act(() => {
        result.current.inputNumber("5")
      })
      act(() => {
        result.current.calculate()
      })

      expect(result.current.display).toBe("4")
    })

    it("should handle division by zero", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("5")
      })
      act(() => {
        result.current.inputOperator("/")
      })
      act(() => {
        result.current.inputNumber("0")
      })
      act(() => {
        result.current.calculate()
      })

      expect(result.current.display).toBe("Erreur")
      expect(result.current.previousValue).toBeNull()
      expect(result.current.operation).toBeNull()
    })
  })

  describe("Error Recovery", () => {
    it("should allow input after error", () => {
      const { result } = renderHook(() => useCalculator(), { wrapper })

      act(() => {
        result.current.inputNumber("5")
      })
      act(() => {
        result.current.inputOperator("/")
      })
      act(() => {
        result.current.inputNumber("0")
      })
      act(() => {
        result.current.calculate()
      })
      act(() => {
        result.current.inputNumber("3")
      })

      expect(result.current.display).toBe("3")
    })
  })
})
