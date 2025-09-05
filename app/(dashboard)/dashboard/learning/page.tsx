"use client"

import { useQuery } from "convex/react"
import {
  BookOpen,
  Brain,
  CheckCircle,
  Clock,
  Play,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MEDICAL_DOMAINS } from "@/constants"
import { api } from "@/convex/_generated/api"

export default function LearningPage() {
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState("all")
  const [questionCount, setQuestionCount] = useState(10)
  const router = useRouter()

  const learningBankQuestions = useQuery(api.questions.getLearningBankQuestions)

  // Filtrer les questions par domaine si sélectionné
  const availableQuestions =
    learningBankQuestions?.filter(
      (item) =>
        selectedDomain === "all" || item.question?.domain === selectedDomain,
    ) || []

  const maxQuestions = Math.min(availableQuestions.length, 50) // Limite à 50 questions max

  const handleStartTraining = () => {
    const params = new URLSearchParams({
      domain: selectedDomain,
      count: questionCount.toString(),
    })
    router.push(`/dashboard/learning/training?${params}`)
  }

  const features = [
    {
      icon: Zap,
      title: "Feedback instantané",
      description:
        "Recevez immédiatement la correction et l'explication après chaque question",
    },
    {
      icon: Target,
      title: "Questions ciblées",
      description:
        "Choisissez un domaine spécifique ou entraînez-vous sur l'ensemble du programme",
    },
    {
      icon: Brain,
      title: "Apprentissage adaptatif",
      description:
        "Les questions sont sélectionnées aléatoirement pour optimiser votre apprentissage",
    },
    {
      icon: TrendingUp,
      title: "Suivi des progrès",
      description:
        "Analysez vos performances et identifiez vos points d'amélioration",
    },
  ]

  const stats = [
    {
      icon: BookOpen,
      label: "Questions disponibles",
      value: learningBankQuestions?.length || 0,
      color: "text-blue-600",
    },
    {
      icon: Target,
      label: "Domaines couverts",
      value: new Set(
        learningBankQuestions
          ?.map((item) => item.question?.domain)
          .filter(Boolean),
      ).size,
      color: "text-green-600",
    },
    {
      icon: Clock,
      label: "Durée moyenne",
      value: "2-3 min/question",
      color: "text-purple-600",
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 lg:p-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
          <Brain className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-blue-600">Mode Apprentissage</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Entraînez-vous avec des questions aléatoires et recevez un feedback
          instantané
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, index) => (
          <Card key={index} className="text-center">
            <CardContent className="pt-6">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <p className="text-muted-foreground text-sm">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fonctionnalités */}
      <div className="grid gap-6 md:grid-cols-2">
        {features.map((feature, index) => (
          <Card key={index} className="group transition-all hover:shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-900/30">
                  <feature.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comment ça marche */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            Comment ça marche ?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white">
                1
              </div>
              <h3 className="font-semibold">Choisissez vos paramètres</h3>
              <p className="text-muted-foreground text-sm">
                Sélectionnez un domaine et le nombre de questions
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white">
                2
              </div>
              <h3 className="font-semibold">Répondez aux questions</h3>
              <p className="text-muted-foreground text-sm">
                Questions aléatoires tirées de la banque d&apos;apprentissage
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white">
                3
              </div>
              <h3 className="font-semibold">Feedback instantané</h3>
              <p className="text-muted-foreground text-sm">
                Correction, explication et références après chaque question
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bouton de démarrage */}
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="mb-2 text-xl font-bold">Prêt à commencer ?</h3>
            <p className="mb-6 opacity-90">
              Lancez votre session d&apos;entraînement personnalisée
            </p>
            <Button
              onClick={() => setShowStartDialog(true)}
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100"
              disabled={
                !learningBankQuestions || learningBankQuestions.length === 0
              }
            >
              <Play className="mr-2 h-5 w-5" />
              Commencer l&apos;entraînement
            </Button>
            {(!learningBankQuestions || learningBankQuestions.length === 0) && (
              <p className="mt-2 text-sm opacity-75">
                Aucune question disponible pour le moment
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de configuration */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              Configurer l&apos;entraînement
            </DialogTitle>
            <DialogDescription>
              Personnalisez votre session d&apos;entraînement
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domaine médical</Label>
              <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un domaine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les domaines</SelectItem>
                  {MEDICAL_DOMAINS.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {availableQuestions.length} question(s) disponible(s) dans cette
                sélection
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="count">Nombre de questions</Label>
              <Input
                id="count"
                type="number"
                min="1"
                max={maxQuestions}
                value={questionCount}
                onChange={(e) =>
                  setQuestionCount(
                    Math.min(parseInt(e.target.value) || 1, maxQuestions),
                  )
                }
              />
              <p className="text-muted-foreground text-xs">
                Maximum {maxQuestions} questions
              </p>
            </div>

            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                À savoir :
              </h4>
              <ul className="mt-1 space-y-1 text-xs text-blue-800 dark:text-blue-200">
                <li>• Feedback immédiat après chaque question</li>
                <li>• Possibilité d&apos;arrêter à tout moment</li>
                <li>• Questions sélectionnées aléatoirement</li>
                <li>• Aucune limite de temps</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleStartTraining}
              disabled={availableQuestions.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="mr-2 h-4 w-4" />
              Démarrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
