'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, Trophy, ArrowRight, CheckCircle, Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram, Stethoscope, GraduationCap, Award, Clock, Search, Star, Play, ChevronRight, Globe, Shield, Zap, Timer, BarChart3, Settings, RefreshCw, Target, Brain, Heart, Activity, Eye, Microscope, Stethoscope as Steth2, Pill, Baby, Bone, Droplets, Zap as Lightning, Sparkles, Crown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function HomeContent() {
  const { t } = useLanguage();

  const stats = [
    { number: '5000+', label: 'Questions', icon: BookOpen },
    { number: '85%', label: t('home.hero.rate'), icon: Trophy },
    { number: '2000+', label: t('home.hero.satisfied'), icon: Users }
  ];

  // Features section data
  const features = [
    {
      icon: Play,
      title: t('features.instant.title'),
      description: t('features.instant.desc')
    },
    {
      icon: BookOpen,
      title: t('features.summary.title'),
      description: t('features.summary.desc')
    },
    {
      icon: Timer,
      title: t('features.modes.title'),
      description: t('features.modes.desc')
    },
    {
      icon: Target,
      title: t('features.disciplines.title'),
      description: t('features.disciplines.desc')
    },
    {
      icon: BarChart3,
      title: t('features.monitoring.title'),
      description: t('features.monitoring.desc')
    },
    {
      icon: Settings,
      title: t('features.difficulty.title'),
      description: t('features.difficulty.desc')
    },
    {
      icon: RefreshCw,
      title: t('features.update.title'),
      description: t('features.update.desc')
    },
    {
      icon: Brain,
      title: t('features.mnemonics.title'),
      description: t('features.mnemonics.desc')
    }
  ];

  // Medical specialties
  const specialties = [
    { icon: Stethoscope, name: 'Chirurgie générale' },
    { icon: Brain, name: 'Neurologie' },
    { icon: Eye, name: 'Oto-rhino-laryngologie' },
    { icon: Brain, name: 'Psychiatrie' },
    { icon: Activity, name: 'Dermatologie' },
    { icon: Users, name: 'Éthique' },
    { icon: Heart, name: 'Médecine d\'urgence' },
    { icon: Baby, name: 'Pédiatrie' },
    { icon: Activity, name: 'Pneumologie' },
    { icon: Eye, name: 'Ophtalmologie' },
    { icon: Baby, name: 'Obstétrique et gynécologie' },
    { icon: BarChart3, name: 'Statistiques et épidémiologie' },
    { icon: Droplets, name: 'Hématologie' },
    { icon: Activity, name: 'Gastroentérologie' },
    { icon: Heart, name: 'Cardiologie' },
    { icon: Bone, name: 'Orthopédie' },
    { icon: Activity, name: 'Urologie' },
    { icon: Pill, name: 'Endocrinologie' },
    { icon: Activity, name: 'Néphrologie' },
    { icon: Microscope, name: 'Médecine infectieuse' },
    { icon: Bone, name: 'Rhumatologie' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30">
      {/* Top Banner - Modern and minimal */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-center text-center">
            <div className="flex items-center space-x-6 text-sm font-medium">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-yellow-300" />
                <span>{t('home.banner.resources')}</span>
              </div>
              <Link href="/domaines" className="text-blue-100 hover:text-white underline underline-offset-2 transition-colors">
                {t('home.banner.candidates')}
              </Link>
              <span className="text-blue-200">•</span>
              <Link href="/evaluation" className="text-blue-100 hover:text-white underline underline-offset-2 transition-colors">
                {t('home.banner.students')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Section - Ultra modern */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-float" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-blue-500/5 to-indigo-600/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[700px]">
            {/* Left content */}
            <div className="space-y-10 animate-fade-in-up">
              <div className="space-y-8">
                <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold border border-blue-200/50 dark:border-blue-700/50">
                  <Award className="h-4 w-4 mr-2" />
                  {t('home.hero.badge')}
                </div>
                
                <h1 className="font-display text-display-xl gradient-text leading-none">
                  {t('home.hero.title1')}
                  <span className="block">{t('home.hero.title2')}</span>
                  <span className="block">{t('home.hero.title3')}</span>
                </h1>
                
                <p className="text-body-lg text-gray-600 dark:text-gray-300 max-w-lg leading-relaxed">
                  {t('home.hero.description')}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/inscription">
                  <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 text-lg h-auto rounded-2xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 btn-modern">
                    {t('home.hero.signup')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/evaluation">
                  <Button variant="outline" className="glass-card border-2 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-8 py-4 text-lg h-auto rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg">
                    {t('home.hero.try')}
                    <Play className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center space-x-8 pt-8">
                <div className="flex items-center space-x-2">
                  <div className="flex -space-x-2">
                    {[1,2,3,4].map((i) => (
                      <div key={i} className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full border-2 border-white dark:border-gray-800"></div>
                    ))}
                  </div>
                  <div className="ml-3">
                    <div className="flex items-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">2000+ {t('home.hero.satisfied')}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right content - Modern hero image */}
            <div className="relative lg:flex justify-end animate-slide-in-right">
              <div className="relative">
                {/* Main image container */}
                <div className="relative z-10 glass-card rounded-3xl p-2 shadow-2xl">
                  <img
                    src="https://images.pexels.com/photos/5327921/pexels-photo-5327921.jpeg?auto=compress&cs=tinysrgb&w=600"
                    alt="Professionnels médicaux"
                    className="w-full h-[500px] object-cover rounded-2xl"
                  />
                </div>

                {/* Floating elements */}
                <div className="absolute -top-6 -left-6 glass-card rounded-2xl p-4 shadow-lg animate-float z-20">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{t('home.hero.certified')}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('home.hero.validated')}</p>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-6 -right-6 glass-card rounded-2xl p-4 shadow-lg animate-float z-20" style={{animationDelay: '1s'}}>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center">
                      <Trophy className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">85% {t('home.hero.success')}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('home.hero.rate')}</p>
                    </div>
                  </div>
                </div>

                <div className="absolute top-1/2 -left-12 glass-card rounded-xl p-3 shadow-lg animate-pulse-glow z-20">
                  <div className="flex items-center space-x-2">
                    <Star className="h-5 w-5 text-yellow-500 fill-current" />
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">4.9/5</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Ultra modern cards */}
      <section className="section-modern bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20 animate-fade-in-up">
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold mb-8 border border-blue-200/50 dark:border-blue-700/50">
              <Zap className="h-4 w-4 mr-2" />
              {t('features.badge')}
            </div>
            <h2 className="font-display text-display-lg text-gray-900 dark:text-white mb-6">
              {t('features.title')}
            </h2>
            <p className="text-body-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {t('features.description')}
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card-feature animate-fade-in-scale" style={{animationDelay: `${index * 0.1}s`}}>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - Modern and attractive */}
      <section className="section-modern bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            {/* Left side - Content */}
            <div className="space-y-8 animate-slide-in-left">
              <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold border border-green-200/50 dark:border-green-700/50">
                <BookOpen className="h-4 w-4 mr-2" />
                {t('pricing.badge')}
              </div>
              
              <div className="space-y-6">
                <h2 className="font-display text-display-lg text-gray-900 dark:text-white leading-tight">
                  {t('pricing.title')}
                </h2>
                
                <p className="text-body-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                  {t('pricing.description1')}
                </p>
                
                <p className="text-body text-gray-600 dark:text-gray-300 leading-relaxed">
                  {t('pricing.description2')}
                </p>
              </div>

              <Link href="/inscription">
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-4 text-lg h-auto rounded-2xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 btn-modern">
                  {t('pricing.try')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>

            {/* Right side - Pricing card */}
            <div className="animate-slide-in-right" style={{animationDelay: '0.2s'}}>
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur opacity-25"></div>
                <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-2xl overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-8">
                      <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-semibold">
                        {t('pricing.questions')}
                      </div>
                    </div>
                    
                    <div className="mb-8">
                      <div className="flex items-baseline mb-2">
                        <span className="text-6xl font-bold">{t('pricing.price')}</span>
                        <span className="text-xl ml-2 text-blue-100">{t('pricing.period')}</span>
                      </div>
                      <p className="text-blue-100">{t('pricing.access')}</p>
                    </div>

                    <div className="space-y-4 mb-8">
                      {[
                        t('pricing.feature1'),
                        t('pricing.feature2'),
                        t('pricing.feature3'),
                        t('pricing.feature4'),
                        t('pricing.feature5'),
                        t('pricing.feature6')
                      ].map((feature, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <div className="w-5 h-5 bg-green-400 rounded-full flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="h-3 w-3 text-green-900" />
                          </div>
                          <span className="text-blue-50">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Button className="w-full bg-white text-blue-600 hover:bg-blue-50 font-semibold py-4 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl btn-modern">
                      {t('pricing.signup')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Modern gradient */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800"></div>
        <div className="absolute inset-0 bg-black/20"></div>
        
        {/* Animated background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float" style={{animationDelay: '2s'}}></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="animate-fade-in-up">
            <h2 className="font-display text-display-lg text-white mb-8">
              Commencez votre préparation dès aujourd'hui
            </h2>
            <p className="text-body-lg text-blue-100 mb-12 max-w-2xl mx-auto">
              Rejoignez les milliers de candidats qui ont réussi grâce à NOMAQbank
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link href="/inscription">
                <Button className="bg-white text-blue-600 hover:bg-blue-50 px-12 py-4 text-lg h-auto font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 btn-modern">
                  Inscription gratuite
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button variant="outline" className="border-2 border-white/30 text-white hover:bg-white/10 px-12 py-4 text-lg h-auto rounded-2xl font-semibold transition-all duration-300 glass-card-dark">
                Voir les tarifs
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Modern and clean */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {/* Logo and description */}
            <div className="col-span-1 md:col-span-2">
              <Link href="/" className="flex items-center space-x-3 mb-8">
                <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                  <Stethoscope className="h-8 w-8 text-white" />
                </div>
                <span className="text-2xl font-bold font-display">NOMAQbank</span>
              </Link>
              <p className="text-gray-300 leading-relaxed mb-8 max-w-md text-body">
                {t('footer.description')}
              </p>
              <div className="flex space-x-4">
                {[Facebook, Twitter, Linkedin, Instagram].map((Icon, index) => (
                  <a key={index} href="#" className="w-12 h-12 bg-gray-800 rounded-2xl flex items-center justify-center hover:bg-gradient-to-br hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 transform hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold mb-8 font-display">{t('footer.links')}</h3>
              <ul className="space-y-4">
                {[
                  { name: t('nav.home'), href: '/' },
                  { name: t('nav.domains'), href: '/domaines' },
                  { name: 'Évaluation', href: '/evaluation' },
                  { name: t('nav.about'), href: '/a-propos' },
                  { name: 'Tarifs', href: '#' },
                  { name: 'FAQ', href: '#' }
                ].map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-gray-300 hover:text-blue-400 transition-colors duration-200 hover:underline underline-offset-4">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-lg font-semibold mb-8 font-display">{t('footer.contact')}</h3>
              <ul className="space-y-6">
                <li className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
                    <Mail className="h-5 w-5 text-blue-400" />
                  </div>
                  <span className="text-gray-300">contact@nomaqbank.ca</span>
                </li>
                <li className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
                    <Phone className="h-5 w-5 text-blue-400" />
                  </div>
                  <span className="text-gray-300">+1 (514) 123-4567</span>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center mt-1">
                    <MapPin className="h-5 w-5 text-blue-400" />
                  </div>
                  <span className="text-gray-300">Montréal, QC<br />Canada</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-gray-800 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              {t('footer.copyright')}
            </p>
            <div className="flex space-x-8 mt-4 md:mt-0">
              {[
                t('footer.privacy'),
                t('footer.terms'),
                t('footer.legal')
              ].map((link) => (
                <a key={link} href="#" className="text-gray-400 hover:text-blue-400 text-sm transition-colors duration-200 hover:underline underline-offset-4">
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}