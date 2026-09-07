// @vitest-environment node
import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import proxy, { config } from "@/proxy"

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie } : undefined,
  })

// `x-middleware-next: 1` est l'en-tête interne posé par `NextResponse.next()`
// (Next 16.3) ; les deux assertions publiques (200, pas de `location`) le doublent.
const passThroughSignature = (res: Response) => ({
  status: res.status,
  location: res.headers.get("location"),
  next: res.headers.get("x-middleware-next"),
})

describe("proxy", () => {
  it("renvoie un visiteur connecté de l'accueil vers le tableau de bord", () => {
    const res = proxy(request("/", "better-auth.session_token=abc.def"))

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/tableau-de-bord",
    )
  })

  it("reconnaît le cookie posé en HTTPS (préfixe __Secure-)", () => {
    const res = proxy(
      request("/", "__Secure-better-auth.session_token=abc.def"),
    )

    expect(res.status).toBe(307)
  })

  it("laisse passer un visiteur déconnecté sur l'accueil", () => {
    expect(passThroughSignature(proxy(request("/")))).toEqual({
      status: 200,
      location: null,
      next: "1",
    })
  })

  it("ne redirige plus un visiteur déconnecté sur la zone protégée (la garde est dans le layout)", () => {
    expect(passThroughSignature(proxy(request("/tableau-de-bord")))).toEqual({
      status: 200,
      location: null,
      next: "1",
    })
  })

  it("ne s'exécute que pour un porteur de cookie sur les trois pages vitrine — ne pas élargir sans lire la spec 2026-09-06", () => {
    const sessionCookies = [
      "__Secure-better-auth.session_token",
      "better-auth.session_token",
    ]
    expect(config.matcher).toEqual(
      ["/", "/a-propos", "/domaines"].flatMap((source) =>
        sessionCookies.map((key) => ({
          source,
          has: [{ type: "cookie", key }],
        })),
      ),
    )
  })
})
