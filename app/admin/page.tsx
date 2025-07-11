"use client";

import { useState } from "react";
import {
  Users,
  BookOpen,
  DollarSign,
  UserPlus,
  Crown,
  Activity,
  Calendar,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
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
import Image from "next/image";

// Mock data pour le dashboard admin
const dashboardStats = [
  {
    title: "Utilisateurs totaux",
    value: "2,847",
    change: "+12%",
    trend: "up",
    icon: Users,
    color: "from-blue-500 to-indigo-600",
  },
  {
    title: "Utilisateurs Premium",
    value: "1,234",
    change: "+18%",
    trend: "up",
    icon: Crown,
    color: "from-yellow-500 to-orange-600",
  },
  {
    title: "Revenus mensuels",
    value: "45,230€",
    change: "+8%",
    trend: "up",
    icon: DollarSign,
    color: "from-green-500 to-emerald-600",
  },
  {
    title: "Quiz complétés",
    value: "18,456",
    change: "-3%",
    trend: "down",
    icon: BookOpen,
    color: "from-purple-500 to-pink-600",
  },
];

const recentUsers = [
  {
    id: "1",
    name: "Dr. Sarah Martin",
    email: "sarah.martin@example.com",
    type: "premium",
    joinDate: "2024-12-20",
    avatar:
      "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=60",
  },
  {
    id: "2",
    name: "Dr. Ahmed Hassan",
    email: "ahmed.hassan@example.com",
    type: "free",
    joinDate: "2024-12-19",
    avatar:
      "https://images.pexels.com/photos/6749778/pexels-photo-6749778.jpeg?auto=compress&cs=tinysrgb&w=60",
  },
  {
    id: "3",
    name: "Dr. Marie Dubois",
    email: "marie.dubois@example.com",
    type: "premium",
    joinDate: "2024-12-18",
    avatar:
      "https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&cs=tinysrgb&w=60",
  },
];

const recentActivity = [
  {
    action: "Nouvel utilisateur premium",
    user: "Dr. Sarah Martin",
    time: "Il y a 2 heures",
    type: "user",
  },
  { action: "Quiz créé", user: "Admin", time: "Il y a 4 heures", type: "quiz" },
  {
    action: "Paiement reçu",
    user: "Dr. Ahmed Hassan",
    time: "Il y a 6 heures",
    type: "payment",
  },
  {
    action: "Utilisateur supprimé",
    user: "Dr. Jean Dupont",
    time: "Il y a 1 jour",
    type: "user",
  },
];

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState("7d");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white font-display">
            Tableau de bord
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 sm:mt-3 text-base sm:text-lg">
            Vue d&apos;ensemble de la plateforme NOMAQbank
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-3 sm:gap-4 w-full md:w-auto">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-48 h-12 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Dernières 24h</SelectItem>
              <SelectItem value="7d">7 derniers jours</SelectItem>
              <SelectItem value="30d">30 derniers jours</SelectItem>
              <SelectItem value="90d">90 derniers jours</SelectItem>
            </SelectContent>
          </Select>

          <Button className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12 px-6 rounded-xl font-semibold flex items-center justify-center">
            <Eye className="h-5 w-5 mr-2" />
            Rapport détaillé
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {dashboardStats.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div
                className={`w-16 h-16 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center shadow-lg`}
              >
                <stat.icon className="h-8 w-8 text-white" />
              </div>
              <div
                className={`flex items-center space-x-1 text-sm font-medium ${
                  stat.trend === "up" ? "text-green-600" : "text-red-600"
                }`}
              >
                {stat.trend === "up" ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                <span>{stat.change}</span>
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
              {stat.title}
            </h3>
            <p className="text-4xl font-bold text-gray-900 dark:text-white font-display">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts and Analytics */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* User Growth Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
              Croissance des utilisateurs
            </h2>
            <Button variant="outline" size="sm" className="rounded-xl">
              <BarChart3 className="h-4 w-4 mr-2" />
              Exporter
            </Button>
          </div>
          <div className="h-80 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Graphique de croissance
              </p>
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
              Répartition des revenus
            </h2>
            <Button variant="outline" size="sm" className="rounded-xl">
              <PieChart className="h-4 w-4 mr-2" />
              Détails
            </Button>
          </div>
          <div className="h-80 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl flex items-center justify-center">
            <div className="text-center">
              <PieChart className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Graphique des revenus
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity and Users */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Users */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
              Nouveaux utilisateurs
            </h2>
            <Button variant="outline" size="sm" className="rounded-xl">
              <UserPlus className="h-4 w-4 mr-2" />
              Voir tous
            </Button>
          </div>
          <div className="space-y-6">
            {recentUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center space-x-4 p-6 bg-gray-50 dark:bg-gray-700 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
              >
                <Image
                  src={user.avatar}
                  alt={user.name}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-2xl object-cover shadow-lg"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white text-lg">
                    {user.name}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {user.email}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                      user.type === "premium"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    }`}
                  >
                    {user.type === "premium" ? "Premium" : "Gratuit"}
                  </span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {new Date(user.joinDate).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
              Activité récente
            </h2>
            <Button variant="outline" size="sm" className="rounded-xl">
              <Activity className="h-4 w-4 mr-2" />
              Journal complet
            </Button>
          </div>
          <div className="space-y-6">
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-start space-x-4 p-6 bg-gray-50 dark:bg-gray-700 rounded-2xl"
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    activity.type === "user"
                      ? "bg-blue-100 dark:bg-blue-900/30"
                      : activity.type === "quiz"
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-yellow-100 dark:bg-yellow-900/30"
                  }`}
                >
                  {activity.type === "user" ? (
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  ) : activity.type === "quiz" ? (
                    <BookOpen className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <DollarSign className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white text-lg">
                    {activity.action}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {activity.user}
                  </p>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 font-display">
          Actions rapides
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Button className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 flex-col space-y-3 rounded-2xl text-lg font-semibold">
            <UserPlus className="h-8 w-8" />
            <span>Ajouter utilisateur</span>
          </Button>
          <Button className="h-24 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 flex-col space-y-3 rounded-2xl text-lg font-semibold">
            <BookOpen className="h-8 w-8" />
            <span>Créer quiz</span>
          </Button>
          <Button className="h-24 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 flex-col space-y-3 rounded-2xl text-lg font-semibold">
            <BarChart3 className="h-8 w-8" />
            <span>Rapport mensuel</span>
          </Button>
          <Button className="h-24 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 flex-col space-y-3 rounded-2xl text-lg font-semibold">
            <Calendar className="h-8 w-8" />
            <span>Planifier maintenance</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
