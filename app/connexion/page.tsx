"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Stethoscope,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
} from "lucide-react"
import Image from "next/image"

export default function ConnexionPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleCheckboxChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      rememberMe: checked,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Login submitted:", formData)
  }

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

            {/* Success story */}
            <div className="glass-card rounded-2xl p-6 max-w-md border border-blue-100 dark:border-blue-800">
              <div className="flex items-center space-x-4 mb-4">
                <Image
                  src="https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=60"
                  alt="Success story"
                  width={60}
                  height={60}
                  className="w-14 h-14 rounded-2xl object-cover shadow-lg"
                />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Dr. Marie Dubois
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                    Résidente en médecine
                  </p>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm italic leading-relaxed">
                &quot;NOMAQbank m&apos;a aidée à réussir l&apos;EACMC du premier
                coup. Une plateforme indispensable !&quot;
              </p>
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
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-14 text-lg font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 btn-modern"
                >
                  Se connecter
                </Button>

                {/* Google login */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-14 border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg"
                >
                  <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Se connecter avec Google
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
  )
}
