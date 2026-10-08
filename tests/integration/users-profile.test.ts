import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { user } from "@/db/schema"
import { updateProfile } from "@/features/users/actions"
import { requireSession } from "@/lib/auth-guards"
import { createId } from "@/lib/ids"

vi.mock("@/lib/auth-guards", () => ({ requireSession: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const editorId = createId()
const otherId = createId()
const takenUsername = "taken_username"

beforeAll(async () => {
  await db.insert(user).values([
    { id: editorId, name: "Editor", email: `editor-${editorId}@test.invalid` },
    {
      id: otherId,
      name: "Other",
      email: `other-${otherId}@test.invalid`,
      username: takenUsername,
    },
  ])
  vi.mocked(requireSession).mockResolvedValue({
    user: { id: editorId, role: "user" },
  } as never)
})

describe("updateProfile", () => {
  it("met à jour le profil de l'utilisateur courant", async () => {
    const freshUsername = "fresh_username"
    const result = await updateProfile({
      name: "Nouveau Nom",
      username: freshUsername,
      bio: "Bio de test",
    })
    expect(result.success).toBe(true)

    const [row] = await db
      .select({ name: user.name, username: user.username, bio: user.bio })
      .from(user)
      .where(eq(user.id, editorId))
      .limit(1)
    expect(row?.name).toBe("Nouveau Nom")
    expect(row?.username).toBe(freshUsername)
    expect(row?.bio).toBe("Bio de test")
  })

  it("refuse un username déjà pris", async () => {
    const result = await updateProfile({
      name: "Editor",
      username: takenUsername,
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain("déjà pris")
  })
})
