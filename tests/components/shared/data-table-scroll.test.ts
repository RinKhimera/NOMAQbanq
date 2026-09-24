import { describe, expect, it } from "vitest"
import { scrollEdges } from "@/components/shared/data-table/scroll-edges"

describe("scrollEdges — indices de défilement horizontal", () => {
  it("un tableau qui tient dans son cadre n'annonce rien", () => {
    expect(
      scrollEdges({ scrollLeft: 0, scrollWidth: 800, clientWidth: 800 }),
    ).toEqual({ start: false, end: false })
  })

  it("au début d'un tableau qui déborde, seule la droite est annoncée", () => {
    expect(
      scrollEdges({ scrollLeft: 0, scrollWidth: 1200, clientWidth: 800 }),
    ).toEqual({ start: false, end: true })
  })

  it("au milieu, les deux côtés sont annoncés", () => {
    expect(
      scrollEdges({ scrollLeft: 200, scrollWidth: 1200, clientWidth: 800 }),
    ).toEqual({ start: true, end: true })
  })

  // Le zoom navigateur rend scrollLeft fractionnaire : arrivé au bout, il
  // manque parfois moins d'un pixel.
  it("arrivé au bout à moins d'un pixel près, la droite n'est plus annoncée", () => {
    expect(
      scrollEdges({ scrollLeft: 399.5, scrollWidth: 1200, clientWidth: 800 }),
    ).toEqual({ start: true, end: false })
  })
})
