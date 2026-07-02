import { describe, expect, it } from "vitest"
import { CDN_HOST } from "@/lib/cdn"
import {
  classifyImageValue,
  diffMediaRefs,
  referencedAvatarKeys,
} from "@/lib/media-audit"

describe("classifyImageValue", () => {
  it("classe chaque forme de user.image", () => {
    expect(classifyImageValue(null)).toBe("empty")
    expect(classifyImageValue("")).toBe("empty")
    expect(classifyImageValue("data:image/png;base64,AA")).toBe("data")
    expect(classifyImageValue("https://lh3.googleusercontent.com/a/x")).toBe(
      "google",
    )
    expect(classifyImageValue(`https://${CDN_HOST}/avatars/u/1.jpg`)).toBe(
      "cdn-url",
    )
    expect(
      classifyImageValue(
        "https://dn5nrir6z5nr7.cloudfront.net/avatars/u/1.jpg",
      ),
    ).toBe("cdn-url")
    expect(classifyImageValue("avatars/u/1.jpg")).toBe("raw-key")
    expect(classifyImageValue("https://exemple.test/photo.jpg")).toBe(
      "external",
    )
  })
})

describe("diffMediaRefs", () => {
  it("sépare orphelins S3 et liens cassés DB", () => {
    const { orphans, broken } = diffMediaRefs(
      ["avatars/a/1.jpg", "avatars/b/1.jpg"],
      ["avatars/b/1.jpg", "questions/q/1.jpg"],
    )
    expect(orphans).toEqual(["avatars/a/1.jpg"])
    expect(broken).toEqual(["questions/q/1.jpg"])
  })

  it("vide → vide", () => {
    expect(diffMediaRefs([], [])).toEqual({ orphans: [], broken: [] })
  })
})

describe("referencedAvatarKeys", () => {
  it("extrait et déduplique les clés de NOS avatars", () => {
    expect(
      referencedAvatarKeys([
        "avatars/u/1.jpg",
        `https://${CDN_HOST}/avatars/u/1.jpg`, // même clé → dédupliquée
        "https://lh3.googleusercontent.com/a/x", // externe → ignorée
        null,
      ]),
    ).toEqual(["avatars/u/1.jpg"])
  })
})
