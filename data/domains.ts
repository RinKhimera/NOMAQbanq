import { Domain } from "@/types"

export const domains: Domain[] = [
  {
    id: "1",
    title: "Cardiologie",
    description:
      "Pathologies cardiovasculaires, ECG, insuffisance cardiaque et arythmies",
    icon: "Heart",
    questionsCount: 450,
    slug: "cardiologie",
  },
  {
    id: "2",
    title: "Pneumologie",
    description:
      "Maladies respiratoires, asthme, BPCO et infections pulmonaires",
    icon: "Lung",
    questionsCount: 380,
    slug: "pneumologie",
  },
  {
    id: "3",
    title: "Neurologie",
    description:
      "Pathologies neurologiques, AVC, épilepsie et troubles cognitifs",
    icon: "Brain",
    questionsCount: 420,
    slug: "neurologie",
  },
  {
    id: "4",
    title: "Gastroentérologie",
    description:
      "Troubles digestifs, hépatologie et pathologies inflammatoires",
    icon: "Activity",
    questionsCount: 360,
    slug: "gastroenterologie",
  },
  {
    id: "5",
    title: "Gynécologie",
    description:
      "Santé reproductive, obstétrique et pathologies gynécologiques",
    icon: "Baby",
    questionsCount: 320,
    slug: "gynecologie",
  },
  {
    id: "6",
    title: "Pédiatrie",
    description:
      "Médecine de l'enfant, développement et pathologies pédiatriques",
    icon: "Users",
    questionsCount: 340,
    slug: "pediatrie",
  },
]
