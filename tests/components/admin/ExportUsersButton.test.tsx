import { fireEvent, render, screen } from "@testing-library/react"
import { type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ExportUsersButton } from "@/components/admin/export-users-button"
import type { ExportUser } from "@/features/users/dal"

// xlsx ecrit un vrai fichier en Node -> mock pour isoler la logique.
const { writeFileMock, jsonToSheetMock, bookNewMock, bookAppendSheetMock } =
  vi.hoisted(() => ({
    writeFileMock: vi.fn(),
    jsonToSheetMock: vi.fn(() => ({})),
    bookNewMock: vi.fn(() => ({})),
    bookAppendSheetMock: vi.fn(),
  }))

vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: jsonToSheetMock,
    book_new: bookNewMock,
    book_append_sheet: bookAppendSheetMock,
  },
  writeFile: writeFileMock,
}))

// Radix DropdownMenu ne se monte pas fidelement en happy-dom -> stub passthrough
// qui rend toujours le contenu et cable onClick sur un vrai bouton.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: ReactNode
    onClick?: () => void
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

const users: ExportUser[] = [
  {
    name: "Alice Martin",
    username: "alice",
    email: "alice@example.com",
    role: "admin",
    createdAt: 1_700_000_000_000,
    bio: "Bio; avec point-virgule",
  },
  {
    name: "Bob Tremblay",
    username: null,
    email: "bob@example.com",
    role: "user",
    createdAt: 1_705_000_000_000,
    bio: null,
  },
]

describe("ExportUsersButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => "blob:mock")
    URL.revokeObjectURL = vi.fn()
  })

  it("ne rend rien quand la liste est vide", () => {
    const { container } = render(<ExportUsersButton users={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("affiche le declencheur et le nombre d'utilisateurs", () => {
    const { container } = render(<ExportUsersButton users={users} />)
    expect(screen.getByText("Exporter")).toBeInTheDocument()
    expect(container.textContent).toContain("2 utilisateurs")
  })

  it("exporte en Excel via xlsx.writeFile", () => {
    render(<ExportUsersButton users={users} />)
    fireEvent.click(screen.getByText("Excel (XLSX)"))
    expect(jsonToSheetMock).toHaveBeenCalledTimes(1)
    expect(bookAppendSheetMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock.mock.calls[0][1]).toMatch(/^utilisateurs_.*\.xlsx$/)
  })

  it("exporte en CSV via un blob telechargeable", () => {
    render(<ExportUsersButton users={users} />)
    fireEvent.click(screen.getByText("CSV"))
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })
})
