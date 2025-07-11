"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Mail,
  Calendar,
  Award,
  Settings,
  Camera,
  Save,
  ArrowLeft,
  Shield,
  Clock,
  Trophy,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import Image from "next/image";

export default function ProfilePage() {
  const { user, isLoading, updateUser } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/connexion");
    }
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
      });
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = () => {
    updateUser(formData);
    setIsEditing(false);
  };

  const stats = [
    {
      title: "Questions répondues",
      value: user.stats?.questionsAnswered || 0,
      icon: BookOpen,
      color: "from-blue-500 to-indigo-600",
    },
    {
      title: "Score moyen",
      value: `${user.stats?.averageScore || 0}%`,
      icon: Trophy,
      color: "from-green-500 to-emerald-600",
    },
    {
      title: "Temps d'étude",
      value: `${Math.floor((user.stats?.timeSpent || 0) / 60)}h`,
      icon: Clock,
      color: "from-purple-500 to-pink-600",
    },
    {
      title: "Taux de réussite",
      value: `${Math.round(
        ((user.stats?.correctAnswers || 0) /
          (user.stats?.questionsAnswered || 1)) *
          100
      )}%`,
      icon: Award,
      color: "from-orange-500 to-red-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20">
      <div className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200 group mb-6"
          >
            <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform duration-200" />
            Retour au dashboard
          </Link>
          <h1 className="font-display text-display-md text-gray-900 dark:text-white mb-4">
            Mon Profil
          </h1>
          <p className="text-body-lg text-gray-600 dark:text-gray-300">
            Gérez vos informations personnelles et consultez vos statistiques.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <div className="lg:col-span-2">
            <div className="card-modern p-8 mb-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
                  Informations personnelles
                </h2>
                <Button
                  onClick={() =>
                    isEditing ? handleSave() : setIsEditing(true)
                  }
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 btn-modern"
                >
                  {isEditing ? (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Sauvegarder
                    </>
                  ) : (
                    <>
                      <Settings className="mr-2 h-4 w-4" />
                      Modifier
                    </>
                  )}
                </Button>
              </div>

              {/* Profile Picture */}
              <div className="flex items-center space-x-6 mb-8 relative">
                <Image
                  src={
                    user.avatar ||
                    "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150"
                  }
                  alt={user.name}
                  width={96}
                  height={96}
                  className="w-24 h-24 rounded-2xl object-cover shadow-lg"
                />
                {isEditing && (
                  <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors duration-200">
                    <Camera className="h-4 w-4 text-white" />
                  </button>
                )}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {user.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {user.email}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        user.subscription?.type === "premium"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}
                    >
                      {user.subscription?.type === "premium"
                        ? "Premium"
                        : "Gratuit"}
                    </div>
                    <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm font-semibold">
                      {user.role === "admin" ? "Administrateur" : "Utilisateur"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label
                      htmlFor="name"
                      className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                    >
                      Nom complet
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="input-modern h-12"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label
                      htmlFor="email"
                      className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                    >
                      Email
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="input-modern h-12"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Membre depuis
                    </Label>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <Calendar className="h-5 w-5 text-gray-500" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {new Date(user.createdAt).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Dernière connexion
                    </Label>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <Clock className="h-5 w-5 text-gray-500" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString("fr-FR")
                          : "Jamais"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Section */}
            <div className="card-modern p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-display mb-6">
                Sécurité
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <Shield className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Mot de passe
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Dernière modification il y a 30 jours
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                  >
                    Modifier
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Email de récupération
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Configuré et vérifié
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                  >
                    Modifier
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Sidebar */}
          <div className="lg:col-span-1">
            <div className="card-modern p-8 mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white font-display mb-6">
                Mes Statistiques
              </h2>
              <div className="space-y-6">
                {stats.map((stat, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div
                      className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}
                    >
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white font-display">
                        {stat.value}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {stat.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subscription Info */}
            <div className="card-modern p-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white font-display mb-6">
                Abonnement
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Plan actuel
                  </span>
                  <span
                    className={`font-semibold px-3 py-1 rounded-full text-sm ${
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
                      <span className="text-gray-600 dark:text-gray-400">
                        Expire le
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {new Date(
                          user.subscription.expiresAt
                        ).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  )}
                {user.subscription?.type === "free" && (
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 btn-modern">
                    Passer à Premium
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
