"use client";

import { useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Play,
  Users,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Mock quizzes data
const mockQuizzes = [
  {
    id: "1",
    title: "Quiz Cardiologie Avancé",
    description: "Évaluation complète des pathologies cardiovasculaires",
    domain: "Cardiologie",
    questions: 25,
    difficulty: "Avancé",
    createdDate: "2024-12-15",
    attempts: 156,
    averageScore: 72,
    status: "active",
  },
  {
    id: "2",
    title: "Pneumologie - Cas Cliniques",
    description: "Cas cliniques en pneumologie pour l'EACMC",
    domain: "Pneumologie",
    questions: 20,
    difficulty: "Intermédiaire",
    createdDate: "2024-12-10",
    attempts: 203,
    averageScore: 68,
    status: "active",
  },
  {
    id: "3",
    title: "Neurologie - Diagnostics",
    description: "Quiz sur les diagnostics neurologiques",
    domain: "Neurologie",
    questions: 30,
    difficulty: "Avancé",
    createdDate: "2024-12-05",
    attempts: 89,
    averageScore: 75,
    status: "draft",
  },
  {
    id: "4",
    title: "Pédiatrie - Développement",
    description: "Évaluation du développement de l'enfant",
    domain: "Pédiatrie",
    questions: 15,
    difficulty: "Débutant",
    createdDate: "2024-12-01",
    attempts: 234,
    averageScore: 82,
    status: "active",
  },
];

const domains = [
  "Cardiologie",
  "Pneumologie",
  "Neurologie",
  "Pédiatrie",
  "Gastroentérologie",
  "Gynécologie",
];
const difficulties = ["Débutant", "Intermédiaire", "Avancé"];

export default function QuizzesManagement() {
  const [quizzes, setQuizzes] = useState(mockQuizzes);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDomain, setFilterDomain] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isAddQuizOpen, setIsAddQuizOpen] = useState(false);
  const [newQuiz, setNewQuiz] = useState({
    title: "",
    description: "",
    domain: "",
    difficulty: "Débutant",
    questions: 10,
    status: "draft",
  });

  // Filter quizzes
  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchesSearch =
      quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quiz.domain.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDomain =
      filterDomain === "all" || quiz.domain === filterDomain;
    const matchesDifficulty =
      filterDifficulty === "all" || quiz.difficulty === filterDifficulty;
    const matchesStatus =
      filterStatus === "all" || quiz.status === filterStatus;

    return matchesSearch && matchesDomain && matchesDifficulty && matchesStatus;
  });

  const handleAddQuiz = () => {
    const quiz = {
      id: Date.now().toString(),
      ...newQuiz,
      createdDate: new Date().toISOString().split("T")[0],
      attempts: 0,
      averageScore: 0,
    };

    setQuizzes([...quizzes, quiz]);
    setNewQuiz({
      title: "",
      description: "",
      domain: "",
      difficulty: "Débutant",
      questions: 10,
      status: "draft",
    });
    setIsAddQuizOpen(false);
  };

  const handleDeleteQuiz = (quizId: string) => {
    setQuizzes(quizzes.filter((quiz) => quiz.id !== quizId));
  };

  const stats = [
    {
      title: "Total Quiz",
      value: quizzes.length.toString(),
      icon: BookOpen,
      color: "from-blue-500 to-indigo-600",
    },
    {
      title: "Quiz Actifs",
      value: quizzes.filter((q) => q.status === "active").length.toString(),
      icon: Play,
      color: "from-green-500 to-emerald-600",
    },
    {
      title: "Total Questions",
      value: quizzes.reduce((sum, q) => sum + q.questions, 0).toString(),
      icon: Target,
      color: "from-purple-500 to-pink-600",
    },
    {
      title: "Tentatives Totales",
      value: quizzes.reduce((sum, q) => sum + q.attempts, 0).toString(),
      icon: TrendingUp,
      color: "from-orange-500 to-red-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Gestion des Quiz
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Créez et gérez les quiz et modules d&#39;évaluation
          </p>
        </div>

        <Dialog open={isAddQuizOpen} onOpenChange={setIsAddQuizOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Quiz
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Créer un nouveau quiz</DialogTitle>
              <DialogDescription>
                Ajoutez un nouveau quiz ou module d&#39;évaluation à la plateforme.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Titre du quiz</Label>
                <Input
                  id="title"
                  value={newQuiz.title}
                  onChange={(e) =>
                    setNewQuiz({ ...newQuiz, title: e.target.value })
                  }
                  placeholder="Quiz Cardiologie - Niveau 1"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newQuiz.description}
                  onChange={(e) =>
                    setNewQuiz({ ...newQuiz, description: e.target.value })
                  }
                  placeholder="Description détaillée du quiz..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="domain">Domaine</Label>
                  <Select
                    value={newQuiz.domain}
                    onValueChange={(value) =>
                      setNewQuiz({ ...newQuiz, domain: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un domaine" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.map((domain) => (
                        <SelectItem key={domain} value={domain}>
                          {domain}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="difficulty">Difficulté</Label>
                  <Select
                    value={newQuiz.difficulty}
                    onValueChange={(value) =>
                      setNewQuiz({ ...newQuiz, difficulty: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {difficulties.map((difficulty) => (
                        <SelectItem key={difficulty} value={difficulty}>
                          {difficulty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="questions">Nombre de questions</Label>
                  <Input
                    id="questions"
                    type="number"
                    value={newQuiz.questions}
                    onChange={(e) =>
                      setNewQuiz({
                        ...newQuiz,
                        questions: parseInt(e.target.value),
                      })
                    }
                    min="1"
                    max="100"
                  />
                </div>
                <div>
                  <Label htmlFor="status">Statut</Label>
                  <Select
                    value={newQuiz.status}
                    onValueChange={(value) =>
                      setNewQuiz({ ...newQuiz, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="active">Actif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddQuiz} className="w-full">
                Créer le quiz
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}
              >
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              {stat.title}
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher un quiz..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filterDomain} onValueChange={setFilterDomain}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Domaine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les domaines</SelectItem>
              {domains.map((domain) => (
                <SelectItem key={domain} value={domain}>
                  {domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Difficulté" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes difficultés</SelectItem>
              {difficulties.map((difficulty) => (
                <SelectItem key={difficulty} value={difficulty}>
                  {difficulty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quizzes Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredQuizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  quiz.difficulty === "Avancé"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    : quiz.difficulty === "Intermédiaire"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                }`}
              >
                {quiz.difficulty}
              </span>
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    quiz.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                  }`}
                >
                  {quiz.status === "active" ? "Actif" : "Brouillon"}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="cursor-pointer">
                      <Eye className="mr-2 h-4 w-4" />
                      Prévisualiser
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <Edit className="mr-2 h-4 w-4" />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <Users className="mr-2 h-4 w-4" />
                      Statistiques
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-red-600"
                      onClick={() => handleDeleteQuiz(quiz.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {quiz.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
              {quiz.description}
            </p>
            <p className="text-blue-600 dark:text-blue-400 font-semibold mb-4">
              {quiz.domain}
            </p>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Questions
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {quiz.questions}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Tentatives
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {quiz.attempts}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Score moyen
                </span>
                <span className="font-semibold text-green-600">
                  {quiz.averageScore}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Créé le
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {new Date(quiz.createdDate).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Results summary */}
      <div className="text-center text-gray-600 dark:text-gray-400">
        Affichage de {filteredQuizzes.length} quiz sur {quizzes.length} au total
      </div>
    </div>
  );
}
