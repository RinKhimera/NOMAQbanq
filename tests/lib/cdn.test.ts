import { describe, expect, it } from "vitest"

import { CDN_HOST, cdnUrl, resolveAvatarUrl } from "@/lib/cdn"

describe("cdnUrl", () => {
  it("préfixe l'hôte CDN et retire les slashes initiaux", () => {
    expect(cdnUrl("avatars/u1/a.jpg")).toBe(
      `https://${CDN_HOST}/avatars/u1/a.jpg`,
    )
    expect(cdnUrl("/avatars/u1/a.jpg")).toBe(
      `https://${CDN_HOST}/avatars/u1/a.jpg`,
    )
  })
})

describe("resolveAvatarUrl", () => {
  it("retourne null pour une valeur vide", () => {
    expect(resolveAvatarUrl(null)).toBeNull()
    expect(resolveAvatarUrl(undefined)).toBeNull()
    expect(resolveAvatarUrl("")).toBeNull()
  })

  it("laisse les URL absolues intactes (avatar Google)", () => {
    const google = "https://lh3.googleusercontent.com/a/abc=s96-c"
    expect(resolveAvatarUrl(google)).toBe(google)
  })

  it("convertit une clé de stockage S3 en URL CDN", () => {
    expect(resolveAvatarUrl("avatars/jd7/1769.jpg")).toBe(
      `https://${CDN_HOST}/avatars/jd7/1769.jpg`,
    )
  })
})
