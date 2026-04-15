import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api } from "../../convex/_generated/api"
import schema from "../../convex/schema"
import { createAdminUser } from "../helpers/convex-helpers"

const modules = import.meta.glob("../../convex/**/*.ts")

describe("marketing.getMarketingStats", () => {
  it("retourne les valeurs par défaut sur une base vide", async () => {
    const t = convexTest(schema, modules)

    const stats = await t.query(api.marketing.getMarketingStats, {})

    expect(stats.totalQuestions).toBe("0")
    expect(stats.totalUsers).toBe("0")
    expect(stats.totalDomains).toBe(0)
    expect(stats.successRate).toBe("85%")
    expect(stats.rating).toBe("4.9/5")
    expect(stats.topDomains).toEqual([])
  })

  it("agrège questionStats et compte les users", async () => {
    const t = convexTest(schema, modules)
    const { asAdmin } = await createAdminUser(t)

    // Insérer 3 questions dans 2 domaines via l'API (maintient questionStats)
    for (let i = 0; i < 2; i++) {
      await asAdmin.mutation(api.questions.createQuestion, {
        question: `Cardio ${i + 1}`,
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "E",
        objectifCMC: "O",
        domain: "Cardiologie",
      })
    }
    await asAdmin.mutation(api.questions.createQuestion, {
      question: "Neuro",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      explanation: "E",
      objectifCMC: "O",
      domain: "Neurologie",
    })

    const stats = await t.query(api.marketing.getMarketingStats, {})

    // 3 questions → palier "50+" (formatMarketingStat arrondit vers le haut)
    expect(stats.totalQuestions).toBe("50+")
    // Admin déjà créé + zéro user supplémentaire → 1 user
    expect(stats.totalUsers).toBe("50+")
    expect(stats.totalDomains).toBe(2)
    expect(stats.topDomains).toEqual([
      { domain: "Cardiologie", count: 2 },
      { domain: "Neurologie", count: 1 },
    ])
  })

  it("exclut la ligne __total__ des topDomains", async () => {
    const t = convexTest(schema, modules)
    const { asAdmin } = await createAdminUser(t)

    await asAdmin.mutation(api.questions.createQuestion, {
      question: "Q",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      explanation: "E",
      objectifCMC: "O",
      domain: "Cardiologie",
    })

    const stats = await t.query(api.marketing.getMarketingStats, {})

    expect(stats.topDomains.every((d) => d.domain !== "__total__")).toBe(true)
  })

  it("trie topDomains par count décroissant et limite à 10", async () => {
    const t = convexTest(schema, modules)

    // Insérer directement dans questionStats pour contrôler les counts sans
    // créer 11 vraies questions par domaine.
    await t.run(async (ctx) => {
      await ctx.db.insert("questionStats", {
        domain: "__total__",
        count: 100,
        withImagesCount: 0,
      })
      for (let i = 1; i <= 12; i++) {
        await ctx.db.insert("questionStats", {
          domain: `Domaine ${i}`,
          count: i,
        })
      }
    })

    const stats = await t.query(api.marketing.getMarketingStats, {})

    expect(stats.topDomains).toHaveLength(10)
    expect(stats.topDomains[0]).toEqual({ domain: "Domaine 12", count: 12 })
    expect(stats.topDomains[9]).toEqual({ domain: "Domaine 3", count: 3 })
    // Les domaines 1 et 2 sont hors du top 10
    expect(stats.topDomains.map((d) => d.domain)).not.toContain("Domaine 1")
    expect(stats.totalDomains).toBe(12)
  })

  it("formate correctement les paliers marketing (200+, 1000+, etc.)", async () => {
    const t = convexTest(schema, modules)

    // Simuler 2875 questions et 167 users
    await t.run(async (ctx) => {
      await ctx.db.insert("questionStats", {
        domain: "__total__",
        count: 2875,
      })
      for (let i = 0; i < 167; i++) {
        await ctx.db.insert("users", {
          name: `User ${i}`,
          email: `u${i}@example.com`,
          image: "https://example.com/a.png",
          role: "user",
          tokenIdentifier: `tok_${i}`,
        })
      }
    })

    const stats = await t.query(api.marketing.getMarketingStats, {})

    // 2875 → < 5000 → step 500 → ceil(2875/500)*500 = 3000
    expect(stats.totalQuestions).toBe("3000+")
    // 167 → < 200 → step 50 → ceil(167/50)*50 = 200
    expect(stats.totalUsers).toBe("200+")
  })

  it("est public (ne rejette pas sans identité)", async () => {
    const t = convexTest(schema, modules)

    await expect(
      t.query(api.marketing.getMarketingStats, {}),
    ).resolves.toBeDefined()
  })
})
