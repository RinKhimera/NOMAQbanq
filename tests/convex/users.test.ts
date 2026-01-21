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
      ).rejects.toThrow("UNAUTHENTICATED")
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

  describe("getUsersWithFilters", () => {
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

      await expect(
        asUser.query(api.users.getUsersWithFilters, {
          paginationOpts: { numItems: 10, cursor: null },
        }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("retourne tous les utilisateurs sans filtres", async () => {
      const t = convexTest(schema, modules)

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

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
      })

      expect(result.page).toHaveLength(2)
    })

    it("filtre par role admin", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "User",
        email: "user@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_user",
        tokenIdentifier: "https://clerk.dev|clerk_user",
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        role: "admin",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].role).toBe("admin")
    })

    it("filtre par role user", async () => {
      const t = convexTest(schema, modules)

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

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        role: "user",
      })

      expect(result.page).toHaveLength(2)
      expect(result.page.every((u) => u.role === "user")).toBe(true)
    })

    it("filtre par searchQuery sur le nom", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

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

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        searchQuery: "Jean",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].name).toBe("Jean Dupont")
    })

    it("filtre par searchQuery sur l'email", async () => {
      const t = convexTest(schema, modules)

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
        email: "specific@domain.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_user1",
        tokenIdentifier: "https://clerk.dev|clerk_user1",
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        searchQuery: "specific@domain",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].email).toBe("specific@domain.com")
    })

    it("filtre par dateFrom", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()

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

      // All users were created "now", so filtering by past date should include all
      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        dateFrom: now - 1000,
      })

      expect(result.page.length).toBeGreaterThan(0)

      // Filter by future date should return nothing
      const futureResult = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        dateFrom: now + 1000000,
      })

      expect(futureResult.page).toHaveLength(0)
    })

    it("filtre par dateTo", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      // Filter by past date should return nothing (user created now)
      const pastResult = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        dateTo: now - 1000000,
      })

      expect(pastResult.page).toHaveLength(0)

      // Filter by future date should include all
      const futureResult = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        dateTo: now + 1000000,
      })

      expect(futureResult.page.length).toBeGreaterThan(0)
    })

    it("filtre par accessStatus 'active'", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()
      const futureDate = now + 30 * 24 * 60 * 60 * 1000 // 30 days

      // Create admin
      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      // Create user with active access
      await t.mutation(internal.users.createUser, {
        name: "Active User",
        email: "active@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_active",
        tokenIdentifier: "https://clerk.dev|clerk_active",
      })

      // Create user without access
      await t.mutation(internal.users.createUser, {
        name: "No Access User",
        email: "noaccess@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_noaccess",
        tokenIdentifier: "https://clerk.dev|clerk_noaccess",
      })

      // Create userAccess for active user
      const activeUserId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", "clerk_active"))
          .unique()
        return user!._id
      })

      await t.run(async (ctx) => {
        // Create a product first
        const productId = await ctx.db.insert("products", {
          code: "exam_access",
          name: "Exam Access",
          description: "Test",
          priceCAD: 5000,
          durationDays: 30,
          accessType: "exam",
          stripeProductId: "prod_test",
          stripePriceId: "price_test",
          isActive: true,
        })

        // Create transaction
        const txId = await ctx.db.insert("transactions", {
          userId: activeUserId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: futureDate,
          createdAt: now,
          completedAt: now,
        })

        // Create userAccess
        await ctx.db.insert("userAccess", {
          userId: activeUserId,
          accessType: "exam",
          expiresAt: futureDate,
          lastTransactionId: txId,
        })
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        accessStatus: "active",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].name).toBe("Active User")
      expect(result.page[0].examAccess).not.toBeNull()
    })

    it("filtre par accessStatus 'expiring'", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()
      const expiringDate = now + 3 * 24 * 60 * 60 * 1000 // 3 days (within 7 days)

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "Expiring User",
        email: "expiring@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_expiring",
        tokenIdentifier: "https://clerk.dev|clerk_expiring",
      })

      const expiringUserId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) =>
            q.eq("externalId", "clerk_expiring"),
          )
          .unique()
        return user!._id
      })

      await t.run(async (ctx) => {
        const productId = await ctx.db.insert("products", {
          code: "training_access",
          name: "Training Access",
          description: "Test",
          priceCAD: 3000,
          durationDays: 30,
          accessType: "training",
          stripeProductId: "prod_train",
          stripePriceId: "price_train",
          isActive: true,
        })

        const txId = await ctx.db.insert("transactions", {
          userId: expiringUserId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 3000,
          currency: "CAD",
          accessType: "training",
          durationDays: 30,
          accessExpiresAt: expiringDate,
          createdAt: now,
          completedAt: now,
        })

        await ctx.db.insert("userAccess", {
          userId: expiringUserId,
          accessType: "training",
          expiresAt: expiringDate,
          lastTransactionId: txId,
        })
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        accessStatus: "expiring",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].name).toBe("Expiring User")
    })

    it("filtre par accessStatus 'expired'", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()
      const pastDate = now - 24 * 60 * 60 * 1000 // 1 day ago (expired)

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "Expired User",
        email: "expired@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_expired",
        tokenIdentifier: "https://clerk.dev|clerk_expired",
      })

      const expiredUserId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", "clerk_expired"))
          .unique()
        return user!._id
      })

      await t.run(async (ctx) => {
        const productId = await ctx.db.insert("products", {
          code: "exam_access",
          name: "Exam Access",
          description: "Test",
          priceCAD: 5000,
          durationDays: 30,
          accessType: "exam",
          stripeProductId: "prod_exp",
          stripePriceId: "price_exp",
          isActive: true,
        })

        const txId = await ctx.db.insert("transactions", {
          userId: expiredUserId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: pastDate,
          createdAt: now - 35 * 24 * 60 * 60 * 1000,
          completedAt: now - 35 * 24 * 60 * 60 * 1000,
        })

        await ctx.db.insert("userAccess", {
          userId: expiredUserId,
          accessType: "exam",
          expiresAt: pastDate,
          lastTransactionId: txId,
        })
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        accessStatus: "expired",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].name).toBe("Expired User")
    })

    it("filtre par accessStatus 'never'", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()
      const futureDate = now + 30 * 24 * 60 * 60 * 1000

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "Never Access User",
        email: "never@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_never",
        tokenIdentifier: "https://clerk.dev|clerk_never",
      })

      await t.mutation(internal.users.createUser, {
        name: "Has Access User",
        email: "hasaccess@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_hasaccess",
        tokenIdentifier: "https://clerk.dev|clerk_hasaccess",
      })

      // Give access to one user
      const hasAccessUserId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) =>
            q.eq("externalId", "clerk_hasaccess"),
          )
          .unique()
        return user!._id
      })

      await t.run(async (ctx) => {
        const productId = await ctx.db.insert("products", {
          code: "exam_access",
          name: "Exam Access",
          description: "Test",
          priceCAD: 5000,
          durationDays: 30,
          accessType: "exam",
          stripeProductId: "prod_never",
          stripePriceId: "price_never",
          isActive: true,
        })

        const txId = await ctx.db.insert("transactions", {
          userId: hasAccessUserId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: futureDate,
          createdAt: now,
          completedAt: now,
        })

        await ctx.db.insert("userAccess", {
          userId: hasAccessUserId,
          accessType: "exam",
          expiresAt: futureDate,
          lastTransactionId: txId,
        })
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        accessStatus: "never",
      })

      // Admin and Never Access User have no access
      expect(result.page).toHaveLength(2)
      expect(result.page.some((u) => u.name === "Never Access User")).toBe(true)
    })

    it("trie par _creationTime ascendant", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "User A",
        email: "usera@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_usera",
        tokenIdentifier: "https://clerk.dev|clerk_usera",
      })

      await t.mutation(internal.users.createUser, {
        name: "User B",
        email: "userb@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_userb",
        tokenIdentifier: "https://clerk.dev|clerk_userb",
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        sortBy: "_creationTime",
        sortOrder: "asc",
      })

      expect(result.page).toHaveLength(3)
      // First created should be first
      expect(result.page[0].name).toBe("Admin")
    })

    it("trie par _creationTime descendant", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "User Last",
        email: "userlast@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_userlast",
        tokenIdentifier: "https://clerk.dev|clerk_userlast",
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        sortBy: "_creationTime",
        sortOrder: "desc",
      })

      // Last created should be first
      expect(result.page[0].name).toBe("User Last")
    })

    it("trie par role", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "User",
        email: "user@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_user",
        tokenIdentifier: "https://clerk.dev|clerk_user",
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        sortBy: "role",
        sortOrder: "asc",
      })

      expect(result.page[0].role).toBe("admin")
      expect(result.page[1].role).toBe("user")
    })

    it("pagine avec cursor", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

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

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const page1 = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 2, cursor: null },
      })

      expect(page1.page).toHaveLength(2)
      expect(page1.isDone).toBe(false)
      expect(page1.continueCursor).toBeTruthy()

      const page2 = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 2, cursor: page1.continueCursor },
      })

      expect(page2.page).toHaveLength(2)
    })

    it("enrichit avec examAccess daysRemaining", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()
      const futureDate = now + 10 * 24 * 60 * 60 * 1000 // 10 days

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "User With Access",
        email: "access@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_access",
        tokenIdentifier: "https://clerk.dev|clerk_access",
      })

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", "clerk_access"))
          .unique()
        return user!._id
      })

      await t.run(async (ctx) => {
        const productId = await ctx.db.insert("products", {
          code: "exam_access",
          name: "Exam Access",
          description: "Test",
          priceCAD: 5000,
          durationDays: 30,
          accessType: "exam",
          stripeProductId: "prod_enrich",
          stripePriceId: "price_enrich",
          isActive: true,
        })

        const txId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: futureDate,
          createdAt: now,
          completedAt: now,
        })

        await ctx.db.insert("userAccess", {
          userId,
          accessType: "exam",
          expiresAt: futureDate,
          lastTransactionId: txId,
        })
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        searchQuery: "User With Access",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].examAccess).not.toBeNull()
      expect(result.page[0].examAccess!.daysRemaining).toBe(10)
    })

    it("enrichit avec trainingAccess daysRemaining", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()
      const futureDate = now + 15 * 24 * 60 * 60 * 1000 // 15 days

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "Training User",
        email: "training@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_training",
        tokenIdentifier: "https://clerk.dev|clerk_training",
      })

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) =>
            q.eq("externalId", "clerk_training"),
          )
          .unique()
        return user!._id
      })

      await t.run(async (ctx) => {
        const productId = await ctx.db.insert("products", {
          code: "training_access",
          name: "Training Access",
          description: "Test",
          priceCAD: 3000,
          durationDays: 30,
          accessType: "training",
          stripeProductId: "prod_train_enrich",
          stripePriceId: "price_train_enrich",
          isActive: true,
        })

        const txId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 3000,
          currency: "CAD",
          accessType: "training",
          durationDays: 30,
          accessExpiresAt: futureDate,
          createdAt: now,
          completedAt: now,
        })

        await ctx.db.insert("userAccess", {
          userId,
          accessType: "training",
          expiresAt: futureDate,
          lastTransactionId: txId,
        })
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUsersWithFilters, {
        paginationOpts: { numItems: 10, cursor: null },
        searchQuery: "Training User",
      })

      expect(result.page).toHaveLength(1)
      expect(result.page[0].trainingAccess).not.toBeNull()
      expect(result.page[0].trainingAccess!.daysRemaining).toBe(15)
    })
  })

  describe("getUserPanelData", () => {
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

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", "clerk_regular"))
          .unique()
        return user!._id
      })

      const asUser = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_regular",
      })

      await expect(
        asUser.query(api.users.getUserPanelData, { userId }),
      ).rejects.toThrow("Accès non autorisé")
    })

    it("retourne null si utilisateur inexistant", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      // Create a fake ID that doesn't exist
      const fakeId = await t.run(async (ctx) => {
        const admin = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", "clerk_admin"))
          .unique()
        // Delete admin to get an ID that no longer exists
        await ctx.db.delete(admin!._id)
        return admin!._id
      })

      // Recreate admin for auth
      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin2",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUserPanelData, {
        userId: fakeId,
      })

      expect(result).toBeNull()
    })

    it("retourne données complètes avec accès exam", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()
      const futureDate = now + 20 * 24 * 60 * 60 * 1000 // 20 days

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "Target User",
        email: "target@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_target",
        tokenIdentifier: "https://clerk.dev|clerk_target",
      })

      const targetUserId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", "clerk_target"))
          .unique()
        return user!._id
      })

      await t.run(async (ctx) => {
        const productId = await ctx.db.insert("products", {
          code: "exam_access",
          name: "Exam Access",
          description: "Test",
          priceCAD: 5000,
          durationDays: 30,
          accessType: "exam",
          stripeProductId: "prod_panel",
          stripePriceId: "price_panel",
          isActive: true,
        })

        const txId = await ctx.db.insert("transactions", {
          userId: targetUserId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: futureDate,
          createdAt: now,
          completedAt: now,
        })

        await ctx.db.insert("userAccess", {
          userId: targetUserId,
          accessType: "exam",
          expiresAt: futureDate,
          lastTransactionId: txId,
        })
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUserPanelData, {
        userId: targetUserId,
      })

      expect(result).not.toBeNull()
      expect(result!.user.name).toBe("Target User")
      expect(result!.examAccess).not.toBeNull()
      expect(result!.examAccess!.isActive).toBe(true)
      expect(result!.examAccess!.daysRemaining).toBe(20)
      expect(result!.trainingAccess).toBeNull()
    })

    it("retourne données avec transactions enrichies", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()
      const futureDate = now + 30 * 24 * 60 * 60 * 1000

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      await t.mutation(internal.users.createUser, {
        name: "Target User",
        email: "target@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_target",
        tokenIdentifier: "https://clerk.dev|clerk_target",
      })

      const targetUserId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", "clerk_target"))
          .unique()
        return user!._id
      })

      await t.run(async (ctx) => {
        const productId = await ctx.db.insert("products", {
          code: "exam_access",
          name: "Accès Examens Blancs",
          description: "Test product",
          priceCAD: 5000,
          durationDays: 30,
          accessType: "exam",
          stripeProductId: "prod_tx",
          stripePriceId: "price_tx",
          isActive: true,
        })

        const txId = await ctx.db.insert("transactions", {
          userId: targetUserId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: futureDate,
          createdAt: now,
          completedAt: now,
        })

        await ctx.db.insert("userAccess", {
          userId: targetUserId,
          accessType: "exam",
          expiresAt: futureDate,
          lastTransactionId: txId,
        })
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const result = await asAdmin.query(api.users.getUserPanelData, {
        userId: targetUserId,
      })

      expect(result).not.toBeNull()
      expect(result!.recentTransactions).toHaveLength(1)
      expect(result!.recentTransactions[0].product).not.toBeNull()
      expect(result!.recentTransactions[0].product!.name).toBe(
        "Accès Examens Blancs",
      )
      expect(result!.totalTransactionCount).toBe(1)
    })
  })

  describe("getUsersStats", () => {
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

      await expect(asUser.query(api.users.getUsersStats)).rejects.toThrow(
        "Accès non autorisé",
      )
    })

    it("rejette si non authentifié", async () => {
      const t = convexTest(schema, modules)

      await expect(t.query(api.users.getUsersStats)).rejects.toThrow(
        "UNAUTHENTICATED",
      )
    })

    it("retourne le nombre total d'utilisateurs", async () => {
      const t = convexTest(schema, modules)

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

      const stats = await asAdmin.query(api.users.getUsersStats)
      expect(stats.totalUsers).toBe(3)
    })

    it("compte les nouveaux utilisateurs ce mois-ci", async () => {
      const t = convexTest(schema, modules)

      // All users created during test are "this month"
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

      const stats = await asAdmin.query(api.users.getUsersStats)
      expect(stats.newThisMonth).toBe(2)
      // With no users last month, trend should be 100%
      expect(stats.newThisMonthTrend).toBe(100)
    })

    it("compte les accès exam actifs", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()
      const futureDate = now + 30 * 24 * 60 * 60 * 1000

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "User with access",
          email: "access@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_access",
          tokenIdentifier: "https://clerk.dev|clerk_access",
        })
      })

      await t.run(async (ctx) => {
        const productId = await ctx.db.insert("products", {
          code: "exam_access",
          name: "Exam Access",
          description: "Test",
          priceCAD: 5000,
          durationDays: 30,
          accessType: "exam",
          stripeProductId: "prod_stats_exam",
          stripePriceId: "price_stats_exam",
          isActive: true,
        })

        const txId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: futureDate,
          createdAt: now,
          completedAt: now,
        })

        await ctx.db.insert("userAccess", {
          userId,
          accessType: "exam",
          expiresAt: futureDate,
          lastTransactionId: txId,
        })
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const stats = await asAdmin.query(api.users.getUsersStats)
      expect(stats.activeExamAccess).toBe(1)
    })

    it("compte les accès training actifs", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()
      const futureDate = now + 30 * 24 * 60 * 60 * 1000

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "User with training",
          email: "training@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_training",
          tokenIdentifier: "https://clerk.dev|clerk_training",
        })
      })

      await t.run(async (ctx) => {
        const productId = await ctx.db.insert("products", {
          code: "training_access",
          name: "Training Access",
          description: "Test",
          priceCAD: 3000,
          durationDays: 30,
          accessType: "training",
          stripeProductId: "prod_stats_training",
          stripePriceId: "price_stats_training",
          isActive: true,
        })

        const txId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 3000,
          currency: "CAD",
          accessType: "training",
          durationDays: 30,
          accessExpiresAt: futureDate,
          createdAt: now,
          completedAt: now,
        })

        await ctx.db.insert("userAccess", {
          userId,
          accessType: "training",
          expiresAt: futureDate,
          lastTransactionId: txId,
        })
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const stats = await asAdmin.query(api.users.getUsersStats)
      expect(stats.activeTrainingAccess).toBe(1)
    })

    it("compte les accès expirant bientôt (7 jours)", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()
      const expiringDate = now + 3 * 24 * 60 * 60 * 1000 // 3 days (within 7 days)

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Expiring User",
          email: "expiring@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_expiring",
          tokenIdentifier: "https://clerk.dev|clerk_expiring",
        })
      })

      await t.run(async (ctx) => {
        const productId = await ctx.db.insert("products", {
          code: "exam_access",
          name: "Exam Access",
          description: "Test",
          priceCAD: 5000,
          durationDays: 30,
          accessType: "exam",
          stripeProductId: "prod_expiring",
          stripePriceId: "price_expiring",
          isActive: true,
        })

        const txId = await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: expiringDate,
          createdAt: now,
          completedAt: now,
        })

        await ctx.db.insert("userAccess", {
          userId,
          accessType: "exam",
          expiresAt: expiringDate,
          lastTransactionId: txId,
        })
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const stats = await asAdmin.query(api.users.getUsersStats)
      expect(stats.examExpiringCount).toBe(1)
      expect(stats.activeExamAccess).toBe(1) // Still active
    })

    it("calcule le revenu des 30 derniers jours", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()
      const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          name: "Paying User",
          email: "paying@example.com",
          image: "https://example.com/avatar.png",
          role: "user",
          externalId: "clerk_paying",
          tokenIdentifier: "https://clerk.dev|clerk_paying",
        })
      })

      await t.run(async (ctx) => {
        const productId = await ctx.db.insert("products", {
          code: "exam_access",
          name: "Exam Access",
          description: "Test",
          priceCAD: 5000,
          durationDays: 30,
          accessType: "exam",
          stripeProductId: "prod_revenue",
          stripePriceId: "price_revenue",
          isActive: true,
        })

        await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 5000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
          createdAt: tenDaysAgo,
          completedAt: tenDaysAgo,
        })

        await ctx.db.insert("transactions", {
          userId,
          productId,
          type: "manual",
          status: "completed",
          amountPaid: 3000,
          currency: "CAD",
          accessType: "exam",
          durationDays: 30,
          accessExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
          createdAt: now,
          completedAt: now,
        })
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const stats = await asAdmin.query(api.users.getUsersStats)
      expect(stats.recentRevenue).toBe(8000) // 5000 + 3000
      // With no revenue in previous period, trend should be 100%
      expect(stats.revenueTrend).toBe(100)
    })

    it("retourne zéros si aucune donnée d'accès ou revenu", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const stats = await asAdmin.query(api.users.getUsersStats)
      expect(stats.activeExamAccess).toBe(0)
      expect(stats.activeTrainingAccess).toBe(0)
      expect(stats.examExpiringCount).toBe(0)
      expect(stats.trainingExpiringCount).toBe(0)
      expect(stats.recentRevenue).toBe(0)
      expect(stats.revenueTrend).toBe(0)
    })
  })

  describe("getUsersWithPagination - tri par _creationTime", () => {
    it("trie par _creationTime en ordre ascendant", async () => {
      const t = convexTest(schema, modules)

      // Create users sequentially to ensure different _creationTime
      await t.mutation(internal.users.createUser, {
        name: "First User",
        email: "first@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_first",
        tokenIdentifier: "https://clerk.dev|clerk_first",
      })

      await t.mutation(internal.users.createUser, {
        name: "Second User",
        email: "second@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_second",
        tokenIdentifier: "https://clerk.dev|clerk_second",
      })

      await t.mutation(internal.users.createUser, {
        name: "Third User",
        email: "third@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_third",
        tokenIdentifier: "https://clerk.dev|clerk_third",
      })

      const result = await t.query(api.users.getUsersWithPagination, {
        paginationOpts: { numItems: 10, cursor: null },
        sortBy: "_creationTime",
        sortOrder: "asc",
      })

      expect(result.page).toHaveLength(3)
      expect(result.page[0].name).toBe("First User")
      expect(result.page[1].name).toBe("Second User")
      expect(result.page[2].name).toBe("Third User")
    })

    it("trie par _creationTime en ordre descendant", async () => {
      const t = convexTest(schema, modules)

      await t.mutation(internal.users.createUser, {
        name: "First User",
        email: "first@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_first",
        tokenIdentifier: "https://clerk.dev|clerk_first",
      })

      await t.mutation(internal.users.createUser, {
        name: "Second User",
        email: "second@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_second",
        tokenIdentifier: "https://clerk.dev|clerk_second",
      })

      await t.mutation(internal.users.createUser, {
        name: "Third User",
        email: "third@example.com",
        image: "https://example.com/avatar.png",
        role: "user",
        externalId: "clerk_third",
        tokenIdentifier: "https://clerk.dev|clerk_third",
      })

      const result = await t.query(api.users.getUsersWithPagination, {
        paginationOpts: { numItems: 10, cursor: null },
        sortBy: "_creationTime",
        sortOrder: "desc",
      })

      expect(result.page).toHaveLength(3)
      expect(result.page[0].name).toBe("Third User")
      expect(result.page[1].name).toBe("Second User")
      expect(result.page[2].name).toBe("First User")
    })
  })

  describe("getAdminStats - examens actifs", () => {
    it("compte correctement les examens actifs", async () => {
      const t = convexTest(schema, modules)

      const now = Date.now()

      // Create admin
      await t.mutation(internal.users.createUser, {
        name: "Admin",
        email: "admin@example.com",
        image: "https://example.com/avatar.png",
        role: "admin",
        externalId: "clerk_admin",
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      const asAdmin = t.withIdentity({
        tokenIdentifier: "https://clerk.dev|clerk_admin",
      })

      // Create a question using API
      const questionId = await asAdmin.mutation(api.questions.createQuestion, {
        question: "Test question",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "Test",
        objectifCMC: "Test",
        domain: "Test",
      })

      // Create active exam (isActive: true, within date range)
      await asAdmin.mutation(api.exams.createExam, {
        title: "Examen actif",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [],
      })

      // Create inactive exam then deactivate it
      const inactiveExamId = await asAdmin.mutation(api.exams.createExam, {
        title: "Examen inactif",
        startDate: now - 1000,
        endDate: now + 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [],
      })
      await asAdmin.mutation(api.exams.deactivateExam, {
        examId: inactiveExamId,
      })

      // Create expired exam (past endDate)
      await asAdmin.mutation(api.exams.createExam, {
        title: "Examen passé",
        startDate: now - 14 * 24 * 60 * 60 * 1000,
        endDate: now - 7 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [],
      })

      // Create future exam (not started yet)
      await asAdmin.mutation(api.exams.createExam, {
        title: "Examen futur",
        startDate: now + 7 * 24 * 60 * 60 * 1000,
        endDate: now + 14 * 24 * 60 * 60 * 1000,
        questionIds: [questionId],
        allowedParticipants: [],
      })

      const stats = await asAdmin.query(api.users.getAdminStats)
      expect(stats.totalExams).toBe(4)
      expect(stats.activeExams).toBe(1) // Only the first exam is truly active
    })
  })
})
