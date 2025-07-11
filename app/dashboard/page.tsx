"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BookOpen,
  Trophy,
  Clock,
  TrendingUp,
  Users,
  Star,
  Play,
  ArrowRight,
  Brain,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/connexion");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-16 sm:pt-20">
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-16 w-16 sm:h-24 sm:w-24 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const stats = [
    {
      title: "Questions répondues",
      value: user.stats?.questionsAnswered || 0,
      icon: BookOpen,
      color: "from-blue-500 to-indigo-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      change: "+12 cette semaine",
      trend: "up"
    },
    {
      title: "Score moyen",
      value: `${user.stats?.averageScore || 0}%`,
      icon: Trophy,
      color: "from-green-500 to-emerald-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      change: "+5% ce mois",
      trend: "up"
    },
    {
      title: "Temps d'étude",
      value: `${Math.floor((user.stats?.timeSpent || 0) / 60)}h`,
      icon: Clock,
      color: "from-purple-500 to-pink-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
      change: "+2h cette semaine",
      trend: "up"
    },
    {
      title: "Progression",
      value: `${Math.round(
        ((user.stats?.correctAnswers || 0) /
          (user.stats?.questionsAnswered || 1)) *
          100
      )}%`,
      icon: TrendingUp,
      color: "from-orange-500 to-red-600",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
      change: "En amélioration",
      trend: "up"
    },
  ];

  const recentActivities = [
    {
      type: "quiz",
      title: "Quiz Cardiologie",
      score: 85,
      date: "2024-12-20",
      questions: 20,
    },
    {
      type: "quiz",
      title: "Quiz Pneumologie",
      score: 78,
      date: "2024-12-19",
      questions: 15,
    },
    {
      type: "quiz",
      title: "Quiz Neurologie",
      score: 92,
      date: "2024-12-18",
      questions: 25,
    },
  ];

  const quickActions = [
    {
      title: "Nouveau Quiz",
      description: "Commencer une nouvelle évaluation",
      icon: Play,
      href: "/evaluation",
      color: "from-blue-500 to-indigo-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: "Domaines",
      description: "Explorer les domaines médicaux",
      icon: Brain,
      href: "/domaines",
      color: "from-green-500 to-emerald-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
    },
    {
      title: "Profil",
      description: "Gérer votre profil",
      icon: Users,
      href: "/dashboard/profile",
      color: "from-purple-500 to-pink-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-16 sm:pt-20 lg:pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 sm:mb-12 animate-fade-in-up">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="text-center md:text-left">
              <h1 className="font-display text-2xl sm:text-3xl lg:text-display-md text-gray-900 dark:text-white mb-2 sm:mb-4">
                Bonjour, {user.name.split(" ")[0]} ! 👋
              </h1>
              <p className="text-base sm:text-lg lg:text-body-lg text-gray-600 dark:text-gray-300">
                Voici un aperçu de vos progrès et activités récentes.
              </p>
            </div>
            <div className="flex items-center justify-center md:justify-end space-x-4">
              <div className="text-center md:text-right">
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                  Abonnement
                </p>
                <p
                  className={`font-semibold text-base sm:text-lg ${
                    user.subscription?.type === "premium"
                      ? "text-green-600"
                      : "text-blue-600"
                  }`}
                >
                  {user.subscription?.type === "premium"
                    ? "Premium"
                    : "Gratuit"}
                </p>
                <Image
                  src={
                    user.avatar ||
                    "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150"
                  }
                  alt={user.name}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-2xl object-cover shadow-lg"
                  unoptimized={!!user.avatar && user.avatar.startsWith("data:")}
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 sm:p-6 hover:shadow-xl transition-all duration-300 animate-fade-in-scale border border-gray-100 dark:border-gray-700"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.bgColor} w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center`}>
                  <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700 dark:text-gray-200" />
                </div>
                <span className={`text-xs sm:text-sm font-medium px-2 py-1 rounded-full ${
                  stat.trend === "up" ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20" : "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20"
                }`}>
                  {stat.change}
                </span>
              </div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">
                {stat.title}
              </h3>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-display">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-6 font-display">
                Actions rapides
              </h2>
              <div className="space-y-3 sm:space-y-4">
                {quickActions.map((action, index) => (
                  <Link key={index} href={action.href}>
                    <div className="group p-3 sm:p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-300 cursor-pointer border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600">
                      <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 ${action.bgColor} rounded-lg sm:rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                          <action.icon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700 dark:text-gray-200" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300 text-sm sm:text-base truncate">
                            {action.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                            {action.description}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-300 flex-shrink-0" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Subscription Status */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 font-display flex items-center">
                <Crown className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-yellow-500" />
                Abonnement
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Type</span>
                  <span
                    className={`font-semibold px-3 py-1 rounded-full text-xs sm:text-sm ${
                      user.subscription?.type === "premium"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    }`}
                  >
                    {user.subscription?.type === "premium"
                      ? "Premium"
                      : "Gratuit"}
                  </span>
                </div>
                {user.subscription?.type === "premium" &&
                  user.subscription.expiresAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        Expire le
                      </span>
                      <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                        {new Date(
                          user.subscription.expiresAt
                        ).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  )}
                {user.subscription?.type === "free" && (
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 py-2 sm:py-3">
                    <Crown className="h-4 w-4 sm:h-5 sm:w-5" />
                    Passer à Premium
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activities */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-display">
                  Activités récentes
                </h2>
                <Link href="/dashboard/history">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm sm:text-base"
                  >
                    Voir tout
                  </Button>
                </Link>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {recentActivities.map((activity, index) => (
                  <div
                    key={index}
                    className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 hover:shadow-lg bg-gray-50/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                          <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-blue-700 dark:text-blue-300" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                            {activity.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                            {activity.questions} questions •{" "}
                            {new Date(activity.date).toLocaleDateString(
                              "fr-FR"
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-2xl font-bold ${
                            activity.score >= 80
                              ? "text-green-600"
                              : activity.score >= 60
                              ? "text-blue-600"
                              : "text-orange-600"
                          }`}
                        >
                          {activity.score}%
                        </div>
                        <div className="flex items-center space-x-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < Math.floor(activity.score / 20)
                                  ? "text-yellow-400 fill-current"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress Chart Placeholder */}
              <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Progression cette semaine
                </h3>
                <div className="flex items-end space-x-2 h-32">
                  {[65, 78, 82, 75, 88, 92, 85].map((height, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-gradient-to-t from-blue-500 to-indigo-600 rounded-t-lg opacity-80 hover:opacity-100 transition-opacity duration-300"
                      style={{ height: `${height}%` }}
                    ></div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(
                    (day, index) => (
                      <span key={index}>{day}</span>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-12 animate-fade-in-up">
          <div className="relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800"></div>
            <div className="absolute inset-0 bg-black/20"></div>

            <div className="relative z-10 p-12 text-center">
              <h2 className="font-display text-3xl font-bold text-white mb-6">
                Prêt pour votre prochain défi ?
              </h2>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Continuez votre préparation avec de nouveaux quiz et améliorez
                vos performances.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/evaluation">
                  <Button className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 text-lg h-auto font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 btn-modern">
                    <Play className="mr-2 h-5 w-5" />
                    Nouveau Quiz
                  </Button>
                </Link>
                <Link href="/domaines">
                  <Button
                    variant="outline"
                    className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg h-auto rounded-2xl font-semibold transition-all duration-300 glass-card-dark"
                  >
                    Explorer les domaines
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
