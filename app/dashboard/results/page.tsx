"use client";

import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Award,
  Clock,
  Target,
  BookOpen,
  Download,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mock results data
const mockResults = [
  {
    id: "1",
    quizTitle: "Quiz Cardiologie Avancé",
    domain: "Cardiologie",
    date: "2024-12-20",
    score: 85,
    totalQuestions: 25,
    correctAnswers: 21,
    timeSpent: 480, // seconds
    difficulty: "Avancé",
  },
  {
    id: "2",
    quizTitle: "Pneumologie - Cas Cliniques",
    domain: "Pneumologie",
    date: "2024-12-19",
    score: 78,
    totalQuestions: 20,
    correctAnswers: 16,
    timeSpent: 420,
    difficulty: "Intermédiaire",
  },
  {
    id: "3",
    quizTitle: "Neurologie - Diagnostics",
    domain: "Neurologie",
    date: "2024-12-18",
    score: 92,
    totalQuestions: 30,
    correctAnswers: 28,
    timeSpent: 600,
    difficulty: "Avancé",
  },
  {
    id: "4",
    quizTitle: "Pédiatrie - Développement",
    domain: "Pédiatrie",
    date: "2024-12-17",
    score: 70,
    totalQuestions: 15,
    correctAnswers: 11,
    timeSpent: 300,
    difficulty: "Débutant",
  },
  {
    id: "5",
    quizTitle: "Gastroentérologie - Pathologies",
    domain: "Gastroentérologie",
    date: "2024-12-16",
    score: 88,
    totalQuestions: 22,
    correctAnswers: 19,
    timeSpent: 440,
    difficulty: "Intermédiaire",
  },
];

export default function ResultsPage() {
  const [results] = useState(mockResults);
  const [filterDomain, setFilterDomain] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");

  // Filter results
  const filteredResults = results.filter((result) => {
    const matchesDomain =
      filterDomain === "all" || result.domain === filterDomain;
    const matchesPeriod =
      filterPeriod === "all" ||
      (filterPeriod === "7d" &&
        new Date(result.date) >=
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (filterPeriod === "30d" &&
        new Date(result.date) >=
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    return matchesDomain && matchesPeriod;
  });

  // Calculate stats
  const totalQuizzes = filteredResults.length;
  const averageScore =
    totalQuizzes > 0
      ? Math.round(
          filteredResults.reduce((sum, r) => sum + r.score, 0) / totalQuizzes
        )
      : 0;
  const totalQuestions = filteredResults.reduce(
    (sum, r) => sum + r.totalQuestions,
    0
  );
  const totalTimeSpent = filteredResults.reduce(
    (sum, r) => sum + r.timeSpent,
    0
  );

  const stats = [
    {
      title: "Quiz complétés",
      value: totalQuizzes.toString(),
      icon: BookOpen,
      color: "from-blue-500 to-indigo-600",
    },
    {
      title: "Score moyen",
      value: `${averageScore}%`,
      icon: Award,
      color: "from-green-500 to-emerald-600",
    },
    {
      title: "Questions répondues",
      value: totalQuestions.toString(),
      icon: Target,
      color: "from-purple-500 to-pink-600",
    },
    {
      title: "Temps total",
      value: `${Math.floor(totalTimeSpent / 60)}min`,
      icon: Clock,
      color: "from-orange-500 to-red-600",
    },
  ];

  const domains = [...new Set(results.map((r) => r.domain))];

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Mes résultats
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Consultez vos performances et suivez vos progrès
          </p>
        </div>

        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>
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

      {/* Progress Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Évolution des performances
          </h2>
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Voir détails
          </Button>
        </div>
        <div className="h-64 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Graphique d&#39;évolution des scores
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
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

          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute la période</SelectItem>
              <SelectItem value="7d">7 derniers jours</SelectItem>
              <SelectItem value="30d">30 derniers jours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Quiz
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Domaine
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Score
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Questions
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Temps
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Date
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredResults.map((result) => (
                <tr
                  key={result.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {result.quizTitle}
                      </p>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          result.difficulty === "Avancé"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : result.difficulty === "Intermédiaire"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        }`}
                      >
                        {result.difficulty}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-sm font-semibold">
                      {result.domain}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-2xl font-bold ${
                          result.score >= 80
                            ? "text-green-600"
                            : result.score >= 60
                            ? "text-blue-600"
                            : "text-orange-600"
                        }`}
                      >
                        {result.score}%
                      </span>
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${
                              i < Math.floor(result.score / 20)
                                ? "bg-yellow-400"
                                : "bg-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                    {result.correctAnswers}/{result.totalQuestions}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {formatTime(result.timeSpent)}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {new Date(result.date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Détails
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results summary */}
      <div className="text-center text-gray-600 dark:text-gray-400">
        Affichage de {filteredResults.length} résultat(s) sur {results.length}{" "}
        au total
      </div>
    </div>
  );
}
