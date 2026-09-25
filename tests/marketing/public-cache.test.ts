// @vitest-environment node
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

const { unstableCache } = vi.hoisted(() => ({
  unstableCache: vi.fn<
    (fn: unknown, keyParts: string[], options: unknown) => unknown
  >((fn) => fn),
}))

vi.mock("next/cache", () => ({ unstable_cache: unstableCache }))
vi.mock("@/features/marketing/dal", () => ({ getMarketingStats: vi.fn() }))
vi.mock("@/features/payments/dal", () => ({ getAvailableProducts: vi.fn() }))

const loadCachedModule = async (deploymentId: string) => {
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", deploymentId)
  vi.resetModules()
  unstableCache.mockClear()
  await import("@/features/marketing/cached")
  const [stats, products] = unstableCache.mock.calls
  return { stats, products }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("cache des lectures publiques", () => {
  it("met le déploiement dans chaque clé", async () => {
    // Le cache survit aux déploiements : sans ce discriminant, une migration
    // ou une forme de retour modifiée resterait servie périmée.
    const { stats, products } = await loadCachedModule("dpl_abc")
    expect(stats?.[1]).toContain("dpl_abc")
    expect(products?.[1]).toContain("dpl_abc")
  })

  it("donne une clé distincte à chaque lecture", async () => {
    // `cache()` de React rend le texte des deux fonctions identique : seules
    // les clés les séparent.
    const { stats, products } = await loadCachedModule("dpl_abc")
    expect(stats?.[1]).not.toEqual(products?.[1])
  })

  it("garde les stats une semaine et les produits un jour, sous leur tag", async () => {
    const { stats, products } = await loadCachedModule("dpl_abc")
    expect(stats?.[2]).toEqual({
      tags: ["marketing-stats"],
      revalidate: 604_800,
    })
    expect(products?.[2]).toEqual({ tags: ["products"], revalidate: 86_400 })
  })
})

describe("pages publiques", () => {
  // Une page qui relirait le DAL directement réveillerait Neon à chaque
  // régénération (ISR) ou à chaque visite (`/tarifs`, dynamique).
  const pages = [
    "app/(marketing)/page.tsx",
    "app/(marketing)/a-propos/page.tsx",
    "app/(marketing)/domaines/page.tsx",
    "app/(marketing)/evaluation/page.tsx",
    "app/(marketing)/tarifs/page.tsx",
  ]

  it.each(pages)("%s lit les stats et le catalogue en cache", (page) => {
    const source = readFileSync(join(process.cwd(), page), "utf8")
    expect(source).toContain('from "@/features/marketing/cached"')
    expect(source).not.toMatch(/\bgetMarketingStats\b/)
    expect(source).not.toMatch(/\bgetAvailableProducts\b/)
  })
})
