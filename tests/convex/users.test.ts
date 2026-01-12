import { UserJSON } from "@clerk/backend"
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api, internal } from "../../convex/_generated/api"
import schema from "../../convex/schema"

// Import des modules Convex pour convexTest (Vite spécifique)
const modules = import.meta.glob("../../convex/**/*.ts")

describe("users", () => {
  describe("getCurrentUser", () => {
    it("retourne null si non authentifié", async () => {
      const t = convexTest(schema, modules)

      const result = await t.query(api.users.getCurrentUser)
      expect(result).toBeNull()
    })

    it("retourne l'utilisateur si authentifié", async () => {
      const t = convexTest(schema, modules)

      // Créer un utilisateur via la mutation interne
      await t.mutation(internal.users.createUser, {
        name: "Test User",
        email: "test@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_123",
        tokenIdentifier: "https://clerk.dev|clerk_123",
      })

      // Simuler l'authentification avec le même tokenIdentifier
      const asUser = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_123",
      })

      const result = await asUser.query(api.users.getCurrentUser)
      expect(result).not.toBeNull()
      expect(result?.name).toBe("Test User")
      expect(result?.email).toBe("test@example.com")
    })
  })

  describe("isCurrentUserAdmin", () => {
    it("retourne false si non authentifié", async () => {
      const t = convexTest(schema, modules)

      const result = await t.query(api.users.isCurrentUserAdmin)
      expect(result).toBe(false)
    })

    it("retourne false pour un utilisateur standard", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "User Standard",
        email: "user@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_user",
        tokenIdentifier: "https://clerk.dev|clerk_user",
      })

      const asUser = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_user",
      })

      const result = await asUser.query(api.users.isCurrentUserAdmin)
      expect(result).toBe(false)
    })

    it("retourne true pour un admin", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Admin User",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.isCurrentUserAdmin)
      expect(result).toBe(true)
    })
  })

  describe("Clerk Webhooks (Internal Mutations)", () => {
    it("upsertFromClerk crée un nouvel utilisateur", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.upsertFromClerk, {
        data: {
          id: "clerk_new",
          first_name: "John",
          last_name: "Doe",
          email_addresses: [{ email_address: "john@example.com" }],
          image_url: "https://example.com/john.png",
        } as unknown as UserJSON,
      })

      const user = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", "clerk_new"))
          .unique()
      })

      expect(user).not.toBeNull()
      expect(user?.name).toBe("John Doe")
      expect(user?.role).toBe("user")
    })

    it("upsertFromClerk met à jour un utilisateur existant", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Old Name",
        email: "old@example.com",
        image: "https://example.com/old.png",
        role: "user",
        externalId: "clerk_existing",
        tokenIdentifier: "https://clerk.dev|clerk_existing",
      })

      await t.mutation(internal.users.upsertFromClerk, {
        data: {
          id: "clerk_existing",
          first_name: "New",
          last_name: "Name",
          email_addresses: [{ email_address: "new@example.com" }],
          image_url: "https://example.com/new.png",
        } as unknown as UserJSON,
      })

      const user = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) =>
            q.eq("externalId", "clerk_existing"),
          )
          .unique()
      })

      expect(user?.name).toBe("New Name")
      expect(user?.email).toBe("new@example.com")
    })

    it("deleteFromClerk supprime un utilisateur", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "To Delete",
        email: "delete@example.com",
        image: "https://example.com/delete.png",
        role: "user",
        externalId: "clerk_delete",
        tokenIdentifier: "https://clerk.dev|clerk_delete",
      })

      await t.mutation(internal.users.deleteFromClerk, {
        clerkUserId: "clerk_delete",
      })

      const user = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", "clerk_delete"))
          .unique()
      })

      expect(user).toBeNull()
    })
  })

  describe("updateUserProfile", () => {
    it("rejette si non authentifié", async () => {
      const t = convexTest(schema, modules)

      await expect(
        t.mutation(api.users.updateUserProfile, {
          name: "New Name",
          username: "newusername",
        }),
      ).rejects.toThrow("Utilisateur non authentifié")
    })

    it("met à jour le profil avec succès", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Original Name",
        email: "user@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_profile",
        tokenIdentifier: "https://clerk.dev|clerk_profile",
      })

      const asUser = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_profile",
      })

      const result = await asUser.mutation(api.users.updateUserProfile, {
        name: "Updated Name",
        username: "updatedusername",
        bio: "Ma nouvelle bio",
      })

      expect(result.success).toBe(true)

      // Vérifier que les données ont été mises à jour
      const user = await asUser.query(api.users.getCurrentUser)
      expect(user?.name).toBe("Updated Name")
      expect(user?.username).toBe("updatedusername")
      expect(user?.bio).toBe("Ma nouvelle bio")
    })

    it("rejette si le nom d'utilisateur est déjà pris", async () => {
      const t = convexTest(schema, modules)

      // Créer deux utilisateurs
      await t.mutation(internal.users.createUser, {
        name: "User 1",
        email: "user1@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_user1",
        tokenIdentifier: "https://clerk.dev|clerk_user1",
      })

      await t.mutation(internal.users.createUser, {
        name: "User 2",
        email: "user2@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_user2",
        tokenIdentifier: "https://clerk.dev|clerk_user2",
      })

      // User1 prend un username
      const asUser1 = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_user1",
      })
      await asUser1.mutation(api.users.updateUserProfile, {
        name: "User 1",
        username: "takenusername",
      })

      // User2 essaie de prendre le même username
      const asUser2 = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_user2",
      })
      const result = await asUser2.mutation(api.users.updateUserProfile, {
        name: "User 2",
        username: "takenusername",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Ce nom d'utilisateur est déjà pris !")
    })
  })

  describe("getAllUsers", () => {
    it("retourne null si non admin", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Regular User",
        email: "user@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_regular",
        tokenIdentifier: "https://clerk.dev|clerk_regular",
      })

      const asUser = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_regular",
      })

      const result = await asUser.query(api.users.getAllUsers)
      expect(result).toBeNull()
    })

    it("retourne tous les utilisateurs pour un admin", async () => {
      const t = convexTest(schema, modules)

      // Créer un admin et quelques utilisateurs
      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "User 1",
        email: "user1@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_user1",
        tokenIdentifier: "https://clerk.dev|clerk_user1",
      })

      await t.mutation(internal.users.createUser, {
        name: "User 2",
        email: "user2@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_user2",
        tokenIdentifier: "https://clerk.dev|clerk_user2",
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getAllUsers)
      expect(result).toHaveLength(3)
    })
  })

  describe("getAdminStats", () => {
    it("rejette si non admin", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Regular User",
        email: "user@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_regular",
        tokenIdentifier: "https://clerk.dev|clerk_regular",
      })

      const asUser = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_regular",
      })

      await expect(asUser.query(api.users.getAdminStats)).rejects.toThrow(
        "Accès non autorisé",
      )
    })

    it("retourne les statistiques pour un admin", async () => {
      const t = convexTest(schema, modules)

      // Créer un admin et quelques utilisateurs
      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "User 1",
        email: "user1@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_user1",
        tokenIdentifier: "https://clerk.dev|clerk_user1",
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const stats = await asAdmin.query(api.users.getAdminStats)
      expect(stats.totalUsers).toBe(2)
      expect(stats.adminCount).toBe(1)
      expect(stats.regularUserCount).toBe(1)
      expect(stats.totalExams).toBe(0)
      expect(stats.activeExams).toBe(0)
      expect(stats.totalParticipations).toBe(0)
    })
  })

  describe("getUsersWithPagination", () => {
    it("pagine correctement les résultats", async () => {
      const t = convexTest(schema, modules)

      // Créer 5 utilisateurs
      for (let i = 1; i <= 5; i++) {
        await t.mutation(internal.users.createUser, {
          name: `User ${i}`,
          email: `user${i}@example.com`,
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: `clerk_user${i}`,
          tokenIdentifier: `https://clerk.dev|clerk_user${i}`,
        })
      }

      const page1 = await t.query(api.users.getUsersWithPagination, {
        paginationOpts: { numItems: 2, cursor: null },
      })

      expect(page1.page).toHaveLength(2)
      expect(page1.isDone).toBe(false)
      expect(page1.continueCursor).toBeTruthy()

      const page2 = await t.query(api.users.getUsersWithPagination, {
        paginationOpts: { numItems: 2, cursor: page1.continueCursor },
      })

      expect(page2.page).toHaveLength(2)
    })

    it("trie par nom en ordre ascendant", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Zebra",
        email: "zebra@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_zebra",
        tokenIdentifier: "https://clerk.dev|clerk_zebra",
      })

      await t.mutation(internal.users.createUser, {
        name: "Alpha",
        email: "alpha@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_alpha",
        tokenIdentifier: "https://clerk.dev|clerk_alpha",
      })

      await t.mutation(internal.users.createUser, {
        name: "Beta",
        email: "beta@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_beta",
        tokenIdentifier: "https://clerk.dev|clerk_beta",
      })

      const result = await t.query(api.users.getUsersWithPagination, {
        paginationOpts: { numItems: 10, cursor: null },
        sortBy: "name",
        sortOrder: "asc",
      })

      expect(result.page[0].name).toBe("Alpha")
      expect(result.page[1].name).toBe("Beta")
      expect(result.page[2].name).toBe("Zebra")
    })

    it("trie par nom en ordre descendant", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Alpha",
        email: "alpha@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_alpha",
        tokenIdentifier: "https://clerk.dev|clerk_alpha",
      })

      await t.mutation(internal.users.createUser, {
        name: "Zebra",
        email: "zebra@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_zebra",
        tokenIdentifier: "https://clerk.dev|clerk_zebra",
      })

      const result = await t.query(api.users.getUsersWithPagination, {
        paginationOpts: { numItems: 10, cursor: null },
        sortBy: "name",
        sortOrder: "desc",
      })

      expect(result.page[0].name).toBe("Zebra")
      expect(result.page[1].name).toBe("Alpha")
    })

    it("trie par rôle", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "User",
        email: "user@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_user",
        tokenIdentifier: "https://clerk.dev|clerk_user",
      })

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await t.query(api.users.getUsersWithPagination, {
        paginationOpts: { numItems: 10, cursor: null },
        sortBy: "role",
        sortOrder: "asc",
      })

      expect(result.page[0].role).toBe("admin")
      expect(result.page[1].role).toBe("user")
    })

    it("filtre par recherche textuelle sur le nom", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Jean Dupont",
        email: "jean@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_jean",
        tokenIdentifier: "https://clerk.dev|clerk_jean",
      })

      await t.mutation(internal.users.createUser, {
        name: "Marie Martin",
        email: "marie@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_marie",
        tokenIdentifier: "https://clerk.dev|clerk_marie",
      })

      const result = await t.query(api.users.getUsersWithPagination, {
        paginationOpts: { numItems: 10, cursor: null },
        searchQuery: "Jean",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].name).toBe("Jean Dupont")
    })

    it("filtre par recherche textuelle sur l'email", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "User 1",
        email: "specific@domain.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_user1",
        tokenIdentifier: "https://clerk.dev|clerk_user1",
      })

      await t.mutation(internal.users.createUser, {
        name: "User 2",
        email: "other@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_user2",
        tokenIdentifier: "https://clerk.dev|clerk_user2",
      })

      const result = await t.query(api.users.getUsersWithPagination, {
        paginationOpts: { numItems: 10, cursor: null },
        searchQuery: "specific@domain",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].email).toBe("specific@domain.com")
    })

    it("combine tri et recherche", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Alice Doe",
        email: "alice@test.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_alice",
        tokenIdentifier: "https://clerk.dev|clerk_alice",
      })

      await t.mutation(internal.users.createUser, {
        name: "Bob Doe",
        email: "bob@test.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_bob",
        tokenIdentifier: "https://clerk.dev|clerk_bob",
      })

      await t.mutation(internal.users.createUser, {
        name: "Charlie Smith",
        email: "charlie@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_charlie",
        tokenIdentifier: "https://clerk.dev|clerk_charlie",
      })

      const result = await t.query(api.users.getUsersWithPagination, {
        paginationOpts: { numItems: 10, cursor: null },
        searchQuery: "Doe",
        sortBy: "name",
        sortOrder: "desc",
      })

      expect(result.page).toHaveLength(2)
      expect(result.page[0].name).toBe("Bob Doe")
      expect(result.page[1].name).toBe("Alice Doe")
    })
  })
})
