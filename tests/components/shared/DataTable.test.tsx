import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table/data-table"

type Row = { id: string; title: string; domain: string; rate: number }

const rows: Row[] = [
  { id: "a", title: "Première", domain: "Cardiologie", rate: 70 },
  { id: "b", title: "Deuxième", domain: "Pédiatrie", rate: 40 },
]

const columns: DataTableColumn<Row>[] = [
  { id: "title", label: "Question", required: true, cell: (r) => r.title },
  { id: "domain", label: "Domaine", cell: (r) => r.domain },
  { id: "rate", label: "Réussite", cell: (r) => `${r.rate} %` },
]

const KEY = "test:table"

function renderTable() {
  return render(
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      preferencesKey={KEY}
    />,
  )
}

async function openColumnsMenu() {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: /Colonnes/ }))
  return { user, menu: await screen.findByRole("menu") }
}

const headers = () =>
  screen.getAllByRole("columnheader").map((h) => h.textContent)

/** Simule un tableau large de `width` px (happy-dom ne calcule aucune mise en page). */
function stubTableWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width)
}

afterEach(() => {
  localStorage.clear()
})

describe("DataTable — choix des colonnes", () => {
  it("décocher une colonne la retire du tableau, et le choix survit au remontage", async () => {
    const { unmount } = renderTable()
    const { user, menu } = await openColumnsMenu()

    await user.click(
      within(menu).getByRole("menuitemcheckbox", { name: "Domaine" }),
    )
    await user.keyboard("{Escape}")

    expect(headers()).not.toContain("Domaine")
    expect(screen.queryByText("Cardiologie")).not.toBeInTheDocument()

    unmount()
    renderTable()
    expect(headers()).not.toContain("Domaine")
    expect(headers()).toContain("Réussite")
  })

  it("une colonne obligatoire n'est pas proposée au masquage", async () => {
    renderTable()
    const { menu } = await openColumnsMenu()

    const items = within(menu)
      .getAllByRole("menuitemcheckbox")
      .map((item) => item.textContent)
    expect(items).toEqual(["Domaine", "Réussite"])
  })

  it("« Réinitialiser l'affichage » efface le choix et revient aux colonnes par défaut", async () => {
    renderTable()
    const { user, menu } = await openColumnsMenu()
    await user.click(
      within(menu).getByRole("menuitemcheckbox", { name: "Réussite" }),
    )
    await user.click(
      within(menu).getByRole("menuitem", { name: "Réinitialiser l'affichage" }),
    )

    expect(headers()).toEqual(["Question", "Domaine", "Réussite"])
    expect(localStorage.length).toBe(0)
  })
})

describe("DataTable — colonnes par défaut selon la largeur du tableau", () => {
  const tiered: DataTableColumn<Row>[] = [
    { id: "title", label: "Question", required: true, cell: (r) => r.title },
    {
      id: "domain",
      label: "Domaine",
      visibleFrom: "medium",
      cell: (r) => r.domain,
    },
    { id: "rate", label: "Réussite", visibleFrom: "wide", cell: (r) => r.rate },
    { id: "id", label: "Identifiant", visibleFrom: "never", cell: (r) => r.id },
  ]

  const renderTiered = () =>
    render(
      <DataTable
        columns={tiered}
        rows={rows}
        getRowId={(r) => r.id}
        preferencesKey={KEY}
      />,
    )

  it("sans choix enregistré, chaque colonne suit son palier de largeur et « jamais » reste masquée", () => {
    renderTiered()

    expect(headers()).toEqual(["Question", "Domaine", "Réussite"])
    const [, domain, rate] = screen.getAllByRole("columnheader")
    expect(domain).toHaveClass("hidden", "@min-[36rem]:table-cell")
    expect(rate).toHaveClass("hidden", "@min-[54rem]:table-cell")
  })

  it("un premier choix sur un tableau étroit fige ce qui y était affiché", async () => {
    stubTableWidth(375)
    renderTiered()
    const { user, menu } = await openColumnsMenu()

    const checked = within(menu)
      .getAllByRole("menuitemcheckbox")
      .filter((item) => item.getAttribute("aria-checked") === "true")
    expect(checked).toHaveLength(0)

    await user.click(
      within(menu).getByRole("menuitemcheckbox", { name: "Réussite" }),
    )
    await user.keyboard("{Escape}")

    expect(headers()).toEqual(["Question", "Réussite"])
    expect(screen.getAllByRole("columnheader")[1]).not.toHaveClass("hidden")
  })

  it("une colonne ajoutée après le choix enregistré garde son affichage par défaut", () => {
    localStorage.setItem(
      `data-table:${KEY}`,
      JSON.stringify({ visible: ["domain"], known: ["domain", "id"] }),
    )
    renderTiered()

    expect(headers()).toEqual(["Question", "Domaine", "Réussite"])
    expect(screen.getAllByRole("columnheader")[2]).toHaveClass(
      "@min-[54rem]:table-cell",
    )
  })
})
