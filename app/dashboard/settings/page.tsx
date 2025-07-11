"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import {
  Settings,
  Save,
  Bell,
  Shield,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "next-themes";

export default function UserSettings() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [settings, setSettings] = useState({
    // Profile
    name: user?.name || "",
    email: user?.email || "",

    // Security
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",

    // Preferences
    language: "fr",
    timezone: "America/Montreal",

    // Notifications
    emailNotifications: true,
    quizReminders: true,
    progressUpdates: false,
    marketingEmails: false,

    // Privacy
    profileVisibility: "private",
    shareProgress: false,
    dataCollection: true,
  });

  const handleSave = () => {
    // Update user profile
    updateUser({
      name: settings.name,
      email: settings.email,
    });

    // Save other settings logic here
    console.log("Settings saved:", settings);
  };

  const updateSetting = (key: string, value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Paramètres
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Gérez vos préférences et paramètres de compte
          </p>
        </div>

        <Button
          onClick={handleSave}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          <Save className="h-4 w-4 mr-2" />
          Sauvegarder
        </Button>
      </div>

      {/* Settings Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-5 p-1 bg-gray-100 dark:bg-gray-700 rounded-t-2xl">
            <TabsTrigger
              value="profile"
              className="flex items-center space-x-2"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profil</span>
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="flex items-center space-x-2"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Sécurité</span>
            </TabsTrigger>
            <TabsTrigger
              value="preferences"
              className="flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Préférences</span>
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex items-center space-x-2"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger
              value="privacy"
              className="flex items-center space-x-2"
            >
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Confidentialité</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile" className="p-8 space-y-6">
            <div>
              <Image
                src={
                  user.avatar ||
                  "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150"
                }
                alt={user.name}
                width={96}
                height={96}
                className="w-24 h-24 rounded-2xl object-cover shadow-lg"
                unoptimized={!!user.avatar && user.avatar.startsWith("http")}
              />
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Photo de profil
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Formats acceptés: JPG, PNG (max 5MB)
                </p>
                <Button variant="outline">Changer la photo</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="name">Nom complet</Label>
                <Input
                  id="name"
                  value={settings.name}
                  onChange={(e) => updateSetting("name", e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => updateSetting("email", e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-100">
                    Email vérifié
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Votre adresse email a été vérifiée avec succès
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="p-8 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Changer le mot de passe
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                  <div className="relative mt-2">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={settings.currentPassword}
                      onChange={(e) =>
                        updateSetting("currentPassword", e.target.value)
                      }
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                    <div className="relative mt-2">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={settings.newPassword}
                        onChange={(e) =>
                          updateSetting("newPassword", e.target.value)
                        }
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">
                      Confirmer le mot de passe
                    </Label>
                    <div className="relative mt-2">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={settings.confirmPassword}
                        onChange={(e) =>
                          updateSetting("confirmPassword", e.target.value)
                        }
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  Mettre à jour le mot de passe
                </Button>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Sessions actives
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      Session actuelle
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Chrome sur Windows • Montréal, QC
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full text-sm font-semibold">
                    Actuelle
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Preferences Settings */}
          <TabsContent value="preferences" className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="language">Langue</Label>
                <Select
                  value={settings.language}
                  onValueChange={(value) => updateSetting("language", value)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="timezone">Fuseau horaire</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => updateSetting("timezone", value)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Montreal">
                      America/Montreal
                    </SelectItem>
                    <SelectItem value="America/Toronto">
                      America/Toronto
                    </SelectItem>
                    <SelectItem value="America/Vancouver">
                      America/Vancouver
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Thème d&apos;affichage</Label>
              <div className="grid grid-cols-3 gap-4 mt-2">
                <button
                  onClick={() => setTheme("light")}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                    theme === "light"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Sun className="h-6 w-6 mx-auto mb-2 text-gray-700 dark:text-gray-300" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Clair
                  </p>
                </button>

                <button
                  onClick={() => setTheme("dark")}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                    theme === "dark"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Moon className="h-6 w-6 mx-auto mb-2 text-gray-700 dark:text-gray-300" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sombre
                  </p>
                </button>

                <button
                  onClick={() => setTheme("system")}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                    theme === "system"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Monitor className="h-6 w-6 mx-auto mb-2 text-gray-700 dark:text-gray-300" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Système
                  </p>
                </button>
              </div>
            </div>
          </TabsContent>

          {/* Notifications Settings */}
          <TabsContent value="notifications" className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Notifications par email
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Recevoir des notifications importantes par email
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) =>
                    updateSetting("emailNotifications", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Rappels de quiz
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Recevoir des rappels pour continuer vos quiz
                  </p>
                </div>
                <Switch
                  checked={settings.quizReminders}
                  onCheckedChange={(checked) =>
                    updateSetting("quizReminders", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Mises à jour de progression
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Recevoir un résumé hebdomadaire de vos progrès
                  </p>
                </div>
                <Switch
                  checked={settings.progressUpdates}
                  onCheckedChange={(checked) =>
                    updateSetting("progressUpdates", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Emails marketing
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Recevoir des informations sur les nouveautés et offres
                  </p>
                </div>
                <Switch
                  checked={settings.marketingEmails}
                  onCheckedChange={(checked) =>
                    updateSetting("marketingEmails", checked)
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* Privacy Settings */}
          <TabsContent value="privacy" className="p-8 space-y-6">
            <div>
              <Label htmlFor="profileVisibility">Visibilité du profil</Label>
              <Select
                value={settings.profileVisibility}
                onValueChange={(value) =>
                  updateSetting("profileVisibility", value)
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Privé</SelectItem>
                  <SelectItem value="friends">Amis seulement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Partager mes progrès
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Permettre aux autres de voir vos statistiques
                  </p>
                </div>
                <Switch
                  checked={settings.shareProgress}
                  onCheckedChange={(checked) =>
                    updateSetting("shareProgress", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Collecte de données analytiques
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Aider à améliorer la plateforme avec vos données d&#39;usage
                  </p>
                </div>
                <Switch
                  checked={settings.dataCollection}
                  onCheckedChange={(checked) =>
                    updateSetting("dataCollection", checked)
                  }
                />
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Gestion des données
              </h3>
              <div className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  Télécharger mes données
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
                >
                  Supprimer mon compte
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
