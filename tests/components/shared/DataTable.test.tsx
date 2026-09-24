import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TIER_MIN_REM } from "@/components/shared/data-table/column-visibility"
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

function renderTable(preferencesKey = KEY) {
  return render(
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      preferencesKey={preferencesKey}
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

// Les classes de conteneur sont écrites en toutes lettres pour Tailwind : ces
// constantes vérifient qu'elles suivent les seuils utilisés par le menu.
const MEDIUM_CLASS = `@min-[${TIER_MIN_REM.medium}rem]:table-cell`
const WIDE_CLASS = `@min-[${TIER_MIN_REM.wide}rem]:table-cell`

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
    expect(domain).toHaveClass("hidden", MEDIUM_CLASS)
    expect(rate).toHaveClass("hidden", WIDE_CLASS)
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
    expect(screen.getAllByRole("columnheader")[2]).toHaveClass(WIDE_CLASS)
  })
})

describe("DataTable — mise en forme", () => {
  it("la mise en page s'applique à l'en-tête, le style des cellules non", () => {
    render(
      <DataTable
        columns={[
          {
            id: "created",
            label: "Créée",
            className: "text-center",
            cellClassName: "text-gray-500",
            cell: () => "hier",
          },
        ]}
        rows={rows}
        getRowId={(r) => r.id}
      />,
    )

    const header = screen.getByRole("columnheader", { name: "Créée" })
    expect(header).toHaveClass("text-center")
    expect(header).not.toHaveClass("text-gray-500")
    expect(screen.getAllByRole("cell")[0]).toHaveClass(
      "text-center",
      "text-gray-500",
    )
  })
})

describe("DataTable — dans un formulaire", () => {
  // Le formulaire de création d'examen englobe le navigateur de questions :
  // un bouton sans `type` y vaut `submit` et enregistrerait l'examen.
  it("aucun bouton du tableau ne soumet le formulaire qui l'englobe", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1200)
    stubTableWidth(800)
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    const onToggle = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <DataTable
          columns={[
            ...columns,
            {
              id: "sorted",
              label: "Triée",
              cell: () => null,
              sort: { direction: "asc", onToggle },
            },
          ]}
          rows={rows}
          getRowId={(r) => r.id}
          preferencesKey={KEY}
        />
      </form>,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: /Triée/ }))
    await user.click(
      screen.getByRole("button", { name: "Défiler vers la droite" }),
    )

    expect(onToggle).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe("DataTable — chargement", () => {
  it("un rechargement en place garde les lignes, grise le tableau mais pas son pied", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isPending
        footer={<button type="button">Page suivante</button>}
      />,
    )

    const busy = screen.getByText("Première").closest("[aria-busy='true']")
    expect(busy).not.toBeNull()
    expect(
      screen
        .getByRole("button", { name: "Page suivante" })
        .closest("[aria-busy='true']"),
    ).toBeNull()
  })

  it("un rechargement qui aboutit à une liste vide grise aussi l'état vide", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        isPending
        empty={<p>Rien ici</p>}
      />,
    )

    expect(
      screen.getByText("Rien ici").closest("[aria-busy='true']"),
    ).not.toBeNull()
  })

  it("une page vide garde son pied de tableau, hors de la zone grisée", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        isPending
        empty={<p>Rien ici</p>}
        footer={<button type="button">Page précédente</button>}
      />,
    )

    const footer = screen.getByRole("button", { name: "Page précédente" })
    expect(footer.closest("[aria-busy='true']")).toBeNull()
  })

  it("hors rechargement, rien n'est marqué occupé", () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id} />)

    expect(
      screen.getByText("Première").closest("[aria-busy='true']"),
    ).toBeNull()
  })

  it("le premier chargement affiche un squelette à la place des lignes", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        isLoading
      />,
    )

    expect(screen.queryAllByRole("columnheader")).toHaveLength(0)
    expect(screen.queryByText("Première")).not.toBeInTheDocument()
  })
})

describe("DataTable — stockage indisponible", () => {
  // Navigation privée stricte, données de site bloquées : localStorage lève.
  it("le choix de colonnes vaut quand même pour la page ouverte", async () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("bloqué", "SecurityError")
    })
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("bloqué", "SecurityError")
    })
    // Clé propre : le repli en mémoire survit au test, au niveau du module.
    renderTable("test:stockage-bloque")
    const { user, menu } = await openColumnsMenu()

    await user.click(
      within(menu).getByRole("menuitemcheckbox", { name: "Domaine" }),
    )
    await user.keyboard("{Escape}")

    expect(headers()).not.toContain("Domaine")
  })
})
