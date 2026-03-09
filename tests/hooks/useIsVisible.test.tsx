import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useIsVisible } from "@/hooks/use-is-visible"

type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: IntersectionCallback
  options: IntersectionObserverInit | undefined
  observedElements: Element[] = []

  constructor(
    callback: IntersectionCallback,
    options?: IntersectionObserverInit,
  ) {
    this.callback = callback
    this.options = options
    MockIntersectionObserver.instances.push(this)
  }

  observe(element: Element) {
    this.observedElements.push(element)
  }

  unobserve(element: Element) {
    this.observedElements = this.observedElements.filter((el) => el !== element)
  }

  disconnect() {
    this.observedElements = []
  }

  // Helper pour simuler un changement de visibilite
  trigger(isIntersecting: boolean) {
    this.callback([
      { isIntersecting } as IntersectionObserverEntry,
    ])
  }
}

describe("useIsVisible", () => {
  let originalIntersectionObserver: typeof IntersectionObserver

  beforeEach(() => {
    originalIntersectionObserver = window.IntersectionObserver
    MockIntersectionObserver.instances = []
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver
    vi.restoreAllMocks()
  })

  it("retourne true initialement (avant qu'un element soit attache)", () => {
    const { result } = renderHook(() => useIsVisible())

    // Le hook initialise isVisible a true
    expect(result.current.isVisible).toBe(true)
    // Le ref callback doit etre une fonction
    expect(typeof result.current.ref).toBe("function")
  })

  it("retourne une fonction ref pour attacher a un element", () => {
    const { result } = renderHook(() => useIsVisible())

    expect(result.current.ref).toBeDefined()
    expect(typeof result.current.ref).toBe("function")
  })

  it("observe l'element quand le ref est attache", () => {
    const { result } = renderHook(() => useIsVisible())
    const element = document.createElement("div")

    act(() => {
      result.current.ref(element)
    })

    expect(MockIntersectionObserver.instances).toHaveLength(1)
    const observer = MockIntersectionObserver.instances[0]
    expect(observer.observedElements).toContain(element)
  })

  it("cree l'observer avec threshold: 0", () => {
    const { result } = renderHook(() => useIsVisible())
    const element = document.createElement("div")

    act(() => {
      result.current.ref(element)
    })

    const observer = MockIntersectionObserver.instances[0]
    expect(observer.options).toEqual({ threshold: 0 })
  })

  it("retourne true quand l'element est visible", () => {
    const { result } = renderHook(() => useIsVisible())
    const element = document.createElement("div")

    act(() => {
      result.current.ref(element)
    })

    const observer = MockIntersectionObserver.instances[0]

    act(() => {
      observer.trigger(true)
    })

    expect(result.current.isVisible).toBe(true)
  })

  it("retourne false quand l'element quitte le viewport", () => {
    const { result } = renderHook(() => useIsVisible())
    const element = document.createElement("div")

    act(() => {
      result.current.ref(element)
    })

    const observer = MockIntersectionObserver.instances[0]

    // D'abord visible
    act(() => {
      observer.trigger(true)
    })
    expect(result.current.isVisible).toBe(true)

    // Puis quitte le viewport
    act(() => {
      observer.trigger(false)
    })
    expect(result.current.isVisible).toBe(false)
  })

  it("deconnecte l'observer au demontage", () => {
    const { result, unmount } = renderHook(() => useIsVisible())
    const element = document.createElement("div")

    act(() => {
      result.current.ref(element)
    })

    const observer = MockIntersectionObserver.instances[0]
    const disconnectSpy = vi.spyOn(observer, "disconnect")

    unmount()

    expect(disconnectSpy).toHaveBeenCalled()
  })

  it("ne cree pas d'observer si aucun element n'est attache", () => {
    renderHook(() => useIsVisible())

    expect(MockIntersectionObserver.instances).toHaveLength(0)
  })

  it("deconnecte l'ancien observer quand le ref change d'element", () => {
    const { result } = renderHook(() => useIsVisible())
    const element1 = document.createElement("div")
    const element2 = document.createElement("span")

    // Attacher le premier element
    act(() => {
      result.current.ref(element1)
    })

    expect(MockIntersectionObserver.instances).toHaveLength(1)
    const firstObserver = MockIntersectionObserver.instances[0]
    const disconnectSpy = vi.spyOn(firstObserver, "disconnect")

    // Attacher un second element (simule un changement de ref)
    act(() => {
      result.current.ref(element2)
    })

    // L'ancien observer doit etre deconnecte
    expect(disconnectSpy).toHaveBeenCalled()
    // Un nouvel observer doit etre cree
    expect(MockIntersectionObserver.instances).toHaveLength(2)
    const secondObserver = MockIntersectionObserver.instances[1]
    expect(secondObserver.observedElements).toContain(element2)
  })

  it("gere le detachement du ref (passage a null)", () => {
    const { result } = renderHook(() => useIsVisible())
    const element = document.createElement("div")

    act(() => {
      result.current.ref(element)
    })

    const observer = MockIntersectionObserver.instances[0]
    const disconnectSpy = vi.spyOn(observer, "disconnect")

    // Detacher l'element
    act(() => {
      result.current.ref(null)
    })

    expect(disconnectSpy).toHaveBeenCalled()
  })

  it("reagit correctement a plusieurs changements de visibilite", () => {
    const { result } = renderHook(() => useIsVisible())
    const element = document.createElement("div")

    act(() => {
      result.current.ref(element)
    })

    const observer = MockIntersectionObserver.instances[0]

    // Sequence: visible -> invisible -> visible -> invisible
    act(() => {
      observer.trigger(true)
    })
    expect(result.current.isVisible).toBe(true)

    act(() => {
      observer.trigger(false)
    })
    expect(result.current.isVisible).toBe(false)

    act(() => {
      observer.trigger(true)
    })
    expect(result.current.isVisible).toBe(true)

    act(() => {
      observer.trigger(false)
    })
    expect(result.current.isVisible).toBe(false)
  })
})
