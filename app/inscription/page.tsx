'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Stethoscope, Eye, EyeOff, Mail, Lock, User, Sparkles, Star, CheckCircle, Award, Shield } from 'lucide-react';

export default function InscriptionPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    acceptTerms: false
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      acceptTerms: checked
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[700px]">
          {/* Left side - Hero content */}
          <div className="space-y-10 animate-slide-in-left">
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold border border-green-200/50 dark:border-green-700/50">
              <Sparkles className="h-4 w-4 mr-2" />
              Commencez gratuitement
            </div>
            
            <div className="space-y-8">
              <h1 className="font-display text-display-lg text-gray-900 dark:text-white leading-tight">
                Commencez à transformer vos
                <span className="block gradient-text">connaissances en réalité.</span>
              </h1>
              
              <p className="text-body-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-lg">
                Créez un compte gratuit et obtenez un accès complet à toutes les fonctionnalités pendant 30 jours.
                Aucune carte de crédit nécessaire. Approuvé par plus de 4 000 professionnels.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Essai gratuit de 30 jours</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Accès complet sans engagement</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Contenu certifié EACMC</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Questions validées par des experts</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Données sécurisées</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Protection maximale de vos informations</p>
                </div>
              </div>
            </div>

            {/* Reviews */}
            <div className="glass-card rounded-2xl p-6 border border-blue-100 dark:border-blue-800">
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex -space-x-2">
                  {[1,2,3,4,5].map((i) => (
                    <img
                      key={i}
                      src={`https://images.pexels.com/photos/532727${i}/pexels-photo-532727${i}.jpeg?auto=compress&cs=tinysrgb&w=60`}
                      alt={`User ${i}`}
                      className="w-12 h-12 rounded-2xl border-2 border-white dark:border-gray-800 object-cover shadow-lg"
                    />
                  ))}
                </div>
                <div>
                  <div className="flex items-center space-x-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                    ))}
                    <span className="text-gray-900 dark:text-white font-semibold ml-2">5.0</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">de plus de 200+ avis</p>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-sm italic leading-relaxed">
                "Une plateforme exceptionnelle qui m'a permis de réussir l'EACMC du premier coup !"
              </p>
            </div>
          </div>

          {/* Right side - Sign up form */}
          <div className="animate-slide-in-right" style={{animationDelay: '0.2s'}}>
            <div className="card-modern p-10 max-w-md mx-auto shadow-2xl">
              {/* Logo */}
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-xl">
                  <Stethoscope className="h-10 w-10 text-white" />
                </div>
              </div>

              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 font-display">
                  S'inscrire
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Commencez votre essai gratuit de 30 jours.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Name */}
                <div className="space-y-3">
                  <Label htmlFor="name" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Nom complet*
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="input-modern h-14 text-lg"
                    placeholder="Entrez votre nom complet"
                  />
                </div>

                {/* Email */}
                <div className="space-y-3">
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Email*
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
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Mot de passe*
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className="input-modern h-14 pr-12 text-lg"
                      placeholder="Créez un mot de passe sécurisé"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
                    >
                      {showPassword ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Doit contenir au moins 8 caractères avec majuscules, minuscules et chiffres.</p>
                </div>

                {/* Terms */}
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="acceptTerms"
                    checked={formData.acceptTerms}
                    onCheckedChange={handleCheckboxChange}
                    className="rounded-lg mt-1"
                  />
                  <Label htmlFor="acceptTerms" className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    J'accepte les{' '}
                    <Link href="#" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline underline-offset-4">
                      conditions d'utilisation
                    </Link>
                    {' '}et la{' '}
                    <Link href="#" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline underline-offset-4">
                      politique de confidentialité
                    </Link>
                  </Label>
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={!formData.acceptTerms}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-14 text-lg font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 btn-modern disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Créer mon compte gratuit
                </Button>

                {/* Google signup */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-14 border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg"
                >
                  <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  S'inscrire avec Google
                </Button>

                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  Vous avez déjà un compte ?{' '}
                  <Link href="/connexion" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold hover:underline underline-offset-4">
                    Se connecter
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