"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Stethoscope,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function ConnexionPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [error, setError] = useState("");
  const { login, isLoading } = useAuth();
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleCheckboxChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      rememberMe: checked,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const success = await login(formData.email, formData.password);

    if (success) {
      router.push("/dashboard");
    } else {
      setError("Email ou mot de passe incorrect");
    }
  };

  // Demo accounts for easy testing
  const demoAccounts = [
    { email: "marie.dubois@example.com", role: "Utilisateur Premium" },
    { email: "ahmed.benali@example.com", role: "Utilisateur Gratuit" },
    { email: "admin@nomaqbank.com", role: "Administrateur" },
  ];

  const fillDemoAccount = (email: string) => {
    setFormData((prev) => ({
      ...prev,
      email,
      password: "demo123",
    }));
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[700px]">
          {/* Left side - Welcome back content */}
          <div className="space-y-10 animate-slide-in-left">
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold border border-blue-200/50 dark:border-blue-700/50">
              <Sparkles className="h-4 w-4 mr-2" />
              Bon retour parmi nous
            </div>

            <div className="space-y-8">
              <h1 className="font-display text-display-lg text-gray-900 dark:text-white leading-tight">
                Bon retour !
                <span className="block gradient-text">Continuez votre</span>
                <span className="block gradient-text">apprentissage.</span>
              </h1>

              <p className="text-body-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-lg">
                Connectez-vous à votre compte NOMAQbank et reprenez votre
                préparation à l&apos;EACMC là où vous vous êtes arrêté.
              </p>
            </div>

            {/* Demo Accounts */}
            <div className="glass-card rounded-2xl p-6 border border-blue-100 dark:border-blue-800">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Comptes de démonstration :
              </h3>
              <div className="space-y-3">
                {demoAccounts.map((account, index) => (
                  <button
                    key={index}
                    onClick={() => fillDemoAccount(account.email)}
                    className="w-full text-left p-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-200 border border-gray-200 dark:border-gray-700"
                  >
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {account.email}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {account.role}
                    </p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                Cliquez sur un compte pour remplir automatiquement les champs
              </p>
            </div>

            {/* Features */}
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Sécurisé et fiable
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Vos données sont protégées
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Accès instantané
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    À toutes vos ressources
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center lg:text-left">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Nouveau sur NOMAQbank ?
              </p>
              <Link href="/inscription">
                <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold px-8 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 btn-modern">
                  Créer un compte gratuit
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Right side - Login form */}
          <div
            className="animate-slide-in-right"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="card-modern p-10 max-w-md mx-auto shadow-2xl">
              {/* Logo */}
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-xl">
                  <Stethoscope className="h-10 w-10 text-white" />
                </div>
              </div>

              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 font-display">
                  Se connecter
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Accédez à votre espace d&apos;apprentissage.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <p className="text-red-700 dark:text-red-300 text-sm">
                    {error}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Email */}
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
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input-modern h-14 text-lg"
                    placeholder="Entrez votre email"
                  />
                </div>

                {/* Password */}
                <div className="space-y-3">
                  <Label
                    htmlFor="password"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className="input-modern h-14 pr-12 text-lg"
                      placeholder="Entrez votre mot de passe"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
                    >
                      {showPassword ? (
                        <EyeOff className="h-6 w-6" />
                      ) : (
                        <Eye className="h-6 w-6" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember me and Forgot password */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="rememberMe"
                      checked={formData.rememberMe}
                      onCheckedChange={handleCheckboxChange}
                      className="rounded-lg"
                    />
                    <Label
                      htmlFor="rememberMe"
                      className="text-sm text-gray-700 dark:text-gray-300 font-medium"
                    >
                      Se souvenir de moi
                    </Label>
                  </div>
                  <Link
                    href="#"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline underline-offset-4"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-14 text-lg font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 btn-modern disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    "Se connecter"
                  )}
                </Button>

                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  Pas encore de compte ?{" "}
                  <Link
                    href="/inscription"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold hover:underline underline-offset-4"
                  >
                    Créer un compte
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
