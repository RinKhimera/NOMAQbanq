import { describe, expect, it } from "vitest"
import {
  CDN_HOST,
  avatarStoragePathFromImageValue,
  cdnUrl,
  resolveAvatarUrl,
} from "@/lib/cdn"

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

  it("laisse les URL protocole-relatives et data: intactes", () => {
    expect(resolveAvatarUrl("//x.test/a.jpg")).toBe("//x.test/a.jpg")
    expect(resolveAvatarUrl("data:image/png;base64,AA")).toBe(
      "data:image/png;base64,AA",
    )
  })
})

describe("avatarStoragePathFromImageValue", () => {
  it("clé brute avatars/ → telle quelle", () => {
    expect(avatarStoragePathFromImageValue("avatars/u/1.jpg")).toBe(
      "avatars/u/1.jpg",
    )
  })

  it("URL CDN courante → path", () => {
    expect(avatarStoragePathFromImageValue(cdnUrl("avatars/u/1.jpg"))).toBe(
      "avatars/u/1.jpg",
    )
  })

  it("URL d'un AUTRE host → path quand même (delete par clé = no-op cross-env)", () => {
    expect(
      avatarStoragePathFromImageValue(
        "https://dn5nrir6z5nr7.cloudfront.net/avatars/u/1.jpg",
      ),
    ).toBe("avatars/u/1.jpg")
  })

  it("URL Google → null (path hors avatars/)", () => {
    expect(
      avatarStoragePathFromImageValue("https://lh3.googleusercontent.com/a/x"),
    ).toBeNull()
  })

  it("data:, null, vide → null", () => {
    expect(
      avatarStoragePathFromImageValue("data:image/png;base64,AA"),
    ).toBeNull()
    expect(avatarStoragePathFromImageValue(null)).toBeNull()
    expect(avatarStoragePathFromImageValue("")).toBeNull()
  })

  it("traversée / hors préfixe → null", () => {
    expect(avatarStoragePathFromImageValue("avatars/../secret")).toBeNull()
    expect(avatarStoragePathFromImageValue("questions/q/1.jpg")).toBeNull()
    expect(
      avatarStoragePathFromImageValue(`https://${CDN_HOST}/questions/q/1.jpg`),
    ).toBeNull()
  })
})
