import { describe, expect, it } from "vitest"
import { getAllFaqQuestions } from "@/app/(marketing)/faq/_data/faq-data"
import { GET } from "@/app/llms.txt/route"
import { DOMAINS, INDEXED_DOMAINS } from "@/constants/domains"

const llms = async () => {
  const res = GET()
  return { res, text: await res.text() }
}

describe("/llms.txt", () => {
  it("répond en texte brut", async () => {
    const { res } = await llms()
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/)
  })

  it("liste chaque domaine indexable, sans « Autres »", async () => {
    const { text } = await llms()
    for (const d of INDEXED_DOMAINS) {
      expect(text).toContain(`(https://nomaqbanq.ca/domaines/${d.slug})`)
    }
    expect(text).not.toContain("/domaines/autres")
  })

  it("le nombre de domaines annoncé correspond à la liste", async () => {
    const { text } = await llms()
    const listed = text.match(/\(https:\/\/nomaqbanq\.ca\/domaines\/[a-z-]+\)/g)

    expect(text).toContain(`les ${DOMAINS.length} domaines`)
    expect(text).toContain(`${listed?.length} ont leur page`)
  })

  it("liste les pages clés de la vitrine", async () => {
    const { text } = await llms()
    for (const path of [
      "/eacmc-partie-1",
      "/domaines",
      "/fonctionnement",
      "/tarifs",
      "/evaluation",
      "/faq",
    ]) {
      expect(text).toContain(`(https://nomaqbanq.ca${path})`)
    }
  })

  it("reprend les questions de la FAQ", async () => {
    const { text } = await llms()
    for (const { q } of getAllFaqQuestions()) expect(text).toContain(q)
  })
})
