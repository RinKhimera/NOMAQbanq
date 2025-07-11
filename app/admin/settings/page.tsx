"use client";

import { useState } from "react";
import {
  Save,
  Globe,
  Shield,
  Bell,
  Mail,
  BookOpen,
  CreditCard,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    // General Settings
    siteName: "NOMAQbank",
    siteDescription: "Plateforme de préparation EACMC",
    defaultLanguage: "fr",
    timezone: "America/Montreal",
    maintenanceMode: false,
    registrationOpen: true,

    // Security Settings
    passwordMinLength: 8,
    requireEmailVerification: true,
    enableTwoFactor: false,
    sessionTimeout: 30,
    maxLoginAttempts: 5,

    // Email Settings
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    fromEmail: "noreply@nomaqbank.com",
    fromName: "NOMAQbank",

    // Quiz Settings
    defaultQuizTime: 20,
    defaultQuestionsPerQuiz: 20,
    allowQuizRetake: true,
    showCorrectAnswers: true,

    // Subscription Settings
    freeTrialDays: 30,
    premiumPrice: 339,
    currency: "CAD",

    // Notifications
    emailNotifications: true,
    systemAlerts: true,
    userRegistrationAlert: true,
    paymentAlert: true,
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleSave = () => {
    // Save settings logic here
    console.log("Settings saved:", settings);
  };

  type SettingsKey = keyof typeof settings;
  type SettingsValue = typeof settings[SettingsKey];

  const updateSetting = (key: SettingsKey, value: SettingsValue) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Paramètres de la plateforme
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Configurez les paramètres globaux de NOMAQbank
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
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-6 p-1 bg-gray-100 dark:bg-gray-700 rounded-t-2xl">
            <TabsTrigger
              value="general"
              className="flex items-center space-x-2"
            >
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Général</span>
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="flex items-center space-x-2"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Sécurité</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center space-x-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="quiz" className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Quiz</span>
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="flex items-center space-x-2"
            >
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Facturation</span>
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex items-center space-x-2"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="siteName">Nom du site</Label>
                <Input
                  id="siteName"
                  value={settings.siteName}
                  onChange={(e) => updateSetting("siteName", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="defaultLanguage">Langue par défaut</Label>
                <Select
                  value={settings.defaultLanguage}
                  onValueChange={(value) =>
                    updateSetting("defaultLanguage", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="siteDescription">Description du site</Label>
              <Textarea
                id="siteDescription"
                value={settings.siteDescription}
                onChange={(e) =>
                  updateSetting("siteDescription", e.target.value)
                }
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="timezone">Fuseau horaire</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => updateSetting("timezone", value)}
                >
                  <SelectTrigger>
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

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Mode maintenance
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Activer le mode maintenance du site
                  </p>
                </div>
                <Switch
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) =>
                    updateSetting("maintenanceMode", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Inscriptions ouvertes
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Permettre aux nouveaux utilisateurs de s&#39;inscrire
                  </p>
                </div>
                <Switch
                  checked={settings.registrationOpen}
                  onCheckedChange={(checked) =>
                    updateSetting("registrationOpen", checked)
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="passwordMinLength">
                  Longueur minimale du mot de passe
                </Label>
                <Input
                  id="passwordMinLength"
                  type="number"
                  value={settings.passwordMinLength}
                  onChange={(e) =>
                    updateSetting("passwordMinLength", parseInt(e.target.value))
                  }
                  min="6"
                  max="20"
                />
              </div>
              <div>
                <Label htmlFor="sessionTimeout">
                  Timeout de session (minutes)
                </Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  value={settings.sessionTimeout}
                  onChange={(e) =>
                    updateSetting("sessionTimeout", parseInt(e.target.value))
                  }
                  min="5"
                  max="120"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="maxLoginAttempts">
                Tentatives de connexion maximales
              </Label>
              <Input
                id="maxLoginAttempts"
                type="number"
                value={settings.maxLoginAttempts}
                onChange={(e) =>
                  updateSetting("maxLoginAttempts", parseInt(e.target.value))
                }
                min="3"
                max="10"
                className="w-full md:w-48"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Vérification email obligatoire
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Exiger la vérification de l&#39;email lors de l&#39;inscription
                  </p>
                </div>
                <Switch
                  checked={settings.requireEmailVerification}
                  onCheckedChange={(checked) =>
                    updateSetting("requireEmailVerification", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Authentification à deux facteurs
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Activer l&#39;A2F pour les administrateurs
                  </p>
                </div>
                <Switch
                  checked={settings.enableTwoFactor}
                  onCheckedChange={(checked) =>
                    updateSetting("enableTwoFactor", checked)
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* Email Settings */}
          <TabsContent value="email" className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="smtpHost">Serveur SMTP</Label>
                <Input
                  id="smtpHost"
                  value={settings.smtpHost}
                  onChange={(e) => updateSetting("smtpHost", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="smtpPort">Port SMTP</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={settings.smtpPort}
                  onChange={(e) =>
                    updateSetting("smtpPort", parseInt(e.target.value))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="smtpUsername">Nom d&#39;utilisateur SMTP</Label>
                <Input
                  id="smtpUsername"
                  value={settings.smtpUsername}
                  onChange={(e) =>
                    updateSetting("smtpUsername", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="smtpPassword">Mot de passe SMTP</Label>
                <div className="relative">
                  <Input
                    id="smtpPassword"
                    type={showPassword ? "text" : "password"}
                    value={settings.smtpPassword}
                    onChange={(e) =>
                      updateSetting("smtpPassword", e.target.value)
                    }
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="fromEmail">Email expéditeur</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  value={settings.fromEmail}
                  onChange={(e) => updateSetting("fromEmail", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="fromName">Nom expéditeur</Label>
                <Input
                  id="fromName"
                  value={settings.fromName}
                  onChange={(e) => updateSetting("fromName", e.target.value)}
                />
              </div>
            </div>
          </TabsContent>

          {/* Quiz Settings */}
          <TabsContent value="quiz" className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="defaultQuizTime">
                  Temps par question (secondes)
                </Label>
                <Input
                  id="defaultQuizTime"
                  type="number"
                  value={settings.defaultQuizTime}
                  onChange={(e) =>
                    updateSetting("defaultQuizTime", parseInt(e.target.value))
                  }
                  min="10"
                  max="120"
                />
              </div>
              <div>
                <Label htmlFor="defaultQuestionsPerQuiz">
                  Questions par quiz
                </Label>
                <Input
                  id="defaultQuestionsPerQuiz"
                  type="number"
                  value={settings.defaultQuestionsPerQuiz}
                  onChange={(e) =>
                    updateSetting(
                      "defaultQuestionsPerQuiz",
                      parseInt(e.target.value)
                    )
                  }
                  min="5"
                  max="100"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Permettre de refaire les quiz
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Les utilisateurs peuvent refaire les quiz
                  </p>
                </div>
                <Switch
                  checked={settings.allowQuizRetake}
                  onCheckedChange={(checked) =>
                    updateSetting("allowQuizRetake", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Afficher les bonnes réponses
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Montrer les réponses correctes après le quiz
                  </p>
                </div>
                <Switch
                  checked={settings.showCorrectAnswers}
                  onCheckedChange={(checked) =>
                    updateSetting("showCorrectAnswers", checked)
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* Billing Settings */}
          <TabsContent value="billing" className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="freeTrialDays">Essai gratuit (jours)</Label>
                <Input
                  id="freeTrialDays"
                  type="number"
                  value={settings.freeTrialDays}
                  onChange={(e) =>
                    updateSetting("freeTrialDays", parseInt(e.target.value))
                  }
                  min="0"
                  max="90"
                />
              </div>
              <div>
                <Label htmlFor="premiumPrice">Prix Premium</Label>
                <Input
                  id="premiumPrice"
                  type="number"
                  value={settings.premiumPrice}
                  onChange={(e) =>
                    updateSetting("premiumPrice", parseInt(e.target.value))
                  }
                  min="1"
                />
              </div>
              <div>
                <Label htmlFor="currency">Devise</Label>
                <Select
                  value={settings.currency}
                  onValueChange={(value) => updateSetting("currency", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAD">CAD - Dollar Canadien</SelectItem>
                    <SelectItem value="USD">USD - Dollar Américain</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                  </SelectContent>
                </Select>
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
                    Activer les notifications par email
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
                    Alertes système
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Recevoir les alertes système importantes
                  </p>
                </div>
                <Switch
                  checked={settings.systemAlerts}
                  onCheckedChange={(checked) =>
                    updateSetting("systemAlerts", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Alerte inscription utilisateur
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Notification lors de nouvelles inscriptions
                  </p>
                </div>
                <Switch
                  checked={settings.userRegistrationAlert}
                  onCheckedChange={(checked) =>
                    updateSetting("userRegistrationAlert", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Alerte paiement
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Notification lors de nouveaux paiements
                  </p>
                </div>
                <Switch
                  checked={settings.paymentAlert}
                  onCheckedChange={(checked) =>
                    updateSetting("paymentAlert", checked)
                  }
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
