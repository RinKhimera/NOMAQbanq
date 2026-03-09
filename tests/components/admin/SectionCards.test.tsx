import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SectionCards } from "@/components/admin/section-cards"

// Mock motion/react
vi.mock("motion/react", async () => {
  const { motionMockFactory } = await import("../../helpers/motion-mock")
  return motionMockFactory
})

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}))

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const fullAdminStats = {
  totalUsers: 350,
  adminCount: 5,
  regularUserCount: 345,
  totalExams: 12,
  activeExams: 3,
  totalParticipations: 890,
}

const fullDomainStats: Record<string, number> = {
  Cardiologie: 150,
  Neurologie: 120,
  Pneumologie: 100,
}

describe("SectionCards", () => {
  it("affiche les 4 cartes statistiques", () => {
    render(
      <SectionCards
        totalQuestions={500}
        domainStats={fullDomainStats}
        adminStats={fullAdminStats}
      />,
    )

    expect(screen.getByText("Total Questions")).toBeInTheDocument()
    expect(screen.getByText("Domaines Couverts")).toBeInTheDocument()
    expect(screen.getByText("Utilisateurs")).toBeInTheDocument()
    expect(screen.getByText("Activité")).toBeInTheDocument()
  })

  it("affiche les valeurs calculées correctement", () => {
    render(
      <SectionCards
        totalQuestions={500}
        domainStats={fullDomainStats}
        adminStats={fullAdminStats}
      />,
    )

    expect(screen.getByText("500")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument() // totalDomains
    expect(screen.getByText("350")).toBeInTheDocument() // totalUsers
    expect(screen.getByText("890")).toBeInTheDocument() // totalParticipations
  })

  it("affiche les croissances positives quand les données existent", () => {
    render(
      <SectionCards
        totalQuestions={500}
        domainStats={fullDomainStats}
        adminStats={fullAdminStats}
      />,
    )

    expect(screen.getByText("+12.5%")).toBeInTheDocument()
    expect(screen.getByText("+8.3%")).toBeInTheDocument()
    expect(screen.getByText("+15.2%")).toBeInTheDocument()
    expect(screen.getByText("+23.8%")).toBeInTheDocument()
  })

  it("affiche 0% de croissance quand les données sont à zéro", () => {
    render(
      <SectionCards
        totalQuestions={0}
        domainStats={{}}
        adminStats={{
          totalUsers: 0,
          adminCount: 0,
          regularUserCount: 0,
          totalExams: 0,
          activeExams: 0,
          totalParticipations: 0,
        }}
      />,
    )

    const zeroGrowths = screen.getAllByText("0%")
    expect(zeroGrowths).toHaveLength(4)
  })

  it("gère les données undefined avec des valeurs par défaut", () => {
    render(
      <SectionCards
        totalQuestions={undefined}
        domainStats={undefined}
        adminStats={undefined}
      />,
    )

    // Toutes les valeurs devraient être 0
    const zeros = screen.getAllByText("0")
    expect(zeros.length).toBeGreaterThanOrEqual(4)
  })

  it("affiche la description des admins et étudiants au pluriel", () => {
    render(
      <SectionCards
        totalQuestions={500}
        domainStats={fullDomainStats}
        adminStats={fullAdminStats}
      />,
    )

    // "5 admins • 345 étudiants"
    expect(screen.getByText(/5 admins/)).toBeInTheDocument()
    expect(screen.getByText(/345 étudiants/)).toBeInTheDocument()
  })

  it("affiche la description au singulier quand admin et étudiant uniques", () => {
    render(
      <SectionCards
        totalQuestions={10}
        domainStats={{ Cardiologie: 10 }}
        adminStats={{
          totalUsers: 2,
          adminCount: 1,
          regularUserCount: 1,
          totalExams: 1,
          activeExams: 1,
          totalParticipations: 5,
        }}
      />,
    )

    // "1 admin • 1 étudiant"
    expect(screen.getByText(/1 admin(?!s)/)).toBeInTheDocument()
    expect(screen.getByText(/1 étudiant(?!s)/)).toBeInTheDocument()
  })

  it("affiche le nombre d'examens actifs et total", () => {
    render(
      <SectionCards
        totalQuestions={500}
        domainStats={fullDomainStats}
        adminStats={fullAdminStats}
      />,
    )

    // "3 examens actifs • 12 total"
    expect(screen.getByText(/3 examens actifs/)).toBeInTheDocument()
    expect(screen.getByText(/12 total/)).toBeInTheDocument()
  })
})
