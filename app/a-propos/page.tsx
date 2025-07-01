'use client';

import TestimonialsCarousel from '@/components/TestimonialsCarousel';
import { Target, Users, Award, Heart, Sparkles, CheckCircle, Star, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AProposPage() {
  const { t } = useLanguage();

  const missions = [
    {
      icon: Target,
      title: 'Notre mission',
      description: 'Accompagner les candidats francophones vers la réussite de l\'EACMC avec des outils adaptés à leur réalité linguistique et culturelle.',
      color: 'from-blue-500 to-indigo-600'
    },
    {
      icon: Users,
      title: 'Notre communauté',
      description: 'Une plateforme créée par des professionnels francophones ayant réussi l\'examen pour partager leur expertise et expérience.',
      color: 'from-green-500 to-emerald-600'
    },
    {
      icon: Award,
      title: 'Notre engagement',
      description: 'Fournir du contenu de qualité, régulièrement mis à jour selon les dernières tendances et exigences de l\'EACMC.',
      color: 'from-purple-500 to-pink-600'
    }
  ];

  const values = [
    { name: 'Excellence académique', icon: Award },
    { name: 'Accompagnement personnalisé', icon: Heart }, 
    { name: 'Innovation pédagogique', icon: Sparkles },
    { name: 'Communauté francophone', icon: Users }
  ];

  const stats = [
    { number: '4000+', label: 'Candidats accompagnés', color: 'from-blue-500 to-indigo-600' },
    { number: '85%', label: 'Taux de réussite', color: 'from-green-500 to-emerald-600' },
    { number: '5000+', label: 'Questions disponibles', color: 'from-purple-500 to-pink-600' },
    { number: '24/7', label: 'Support disponible', color: 'from-orange-500 to-red-600' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/30 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header Section - Ultra modern */}
        <div className="text-center mb-20 animate-fade-in-up">
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold mb-8 border border-blue-200/50 dark:border-blue-700/50">
            <Sparkles className="h-4 w-4 mr-2" />
            {t('about.badge')}
          </div>
          <h1 className="font-display text-display-lg text-gray-900 dark:text-white mb-8 leading-tight">
            {t('about.title')}
          </h1>
          <p className="text-body-lg text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
            {t('about.description')}
          </p>
        </div>

        {/* Stats Section - Modern cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {stats.map((stat, index) => (
            <div key={index} className="card-modern p-8 text-center hover:shadow-xl transition-all duration-300 animate-fade-in-scale" style={{animationDelay: `${index * 0.1}s`}}>
              <div className={`w-16 h-16 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                <Star className="h-8 w-8 text-white" />
              </div>
              <p className="text-4xl font-bold text-gray-900 dark:text-white mb-2 font-display">{stat.number}</p>
              <p className="text-gray-600 dark:text-gray-300 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Story Section - Modern layout */}
        <div className="grid lg:grid-cols-2 gap-20 items-center mb-20">
          <div className="animate-slide-in-left">
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold mb-8 border border-green-200/50 dark:border-green-700/50">
              <Heart className="h-4 w-4 mr-2" />
              {t('about.story.badge')}
            </div>
            <h2 className="font-display text-display-md text-gray-900 dark:text-white mb-8">
              {t('about.story.title')}
            </h2>
            <div className="space-y-6 text-body text-gray-700 dark:text-gray-300 leading-relaxed">
              <p>
                NOMAQbank est née d'un constat simple : les candidats francophones à l'EACMC 
                manquaient de ressources adaptées à leur langue et à leur contexte culturel.
              </p>
              <p>
                Fondée par des professionnels de santé francophones ayant réussi l'examen, 
                notre plateforme combine expertise médicale et compréhension des défis 
                spécifiques auxquels font face les candidats francophones.
              </p>
              <p>
                Aujourd'hui, nous accompagnons des milliers de candidats vers la réussite, 
                avec un taux de succès de 85% parmi nos utilisateurs actifs.
              </p>
            </div>
            
            <div className="flex items-center space-x-4 mt-8">
              <div className="flex -space-x-2">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full border-2 border-white dark:border-gray-800 shadow-lg"></div>
                ))}
              </div>
              <div>
                <div className="flex items-center space-x-1 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Plus de 4000 candidats nous font confiance</p>
              </div>
            </div>
          </div>
          
          <div className="relative animate-slide-in-right" style={{animationDelay: '0.2s'}}>
            <div className="relative z-10 glass-card rounded-3xl p-2 shadow-2xl">
              <img
                src="https://images.pexels.com/photos/5327921/pexels-photo-5327921.jpeg?auto=compress&cs=tinysrgb&w=600"
                alt="Équipe médicale francophone"
                className="w-full h-[400px] object-cover rounded-2xl"
              />
            </div>
            
            {/* Floating elements */}
            <div className="absolute -top-6 -right-6 glass-card rounded-2xl p-4 shadow-lg animate-float z-20">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Certifié EACMC</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Contenu validé</p>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-6 -left-6 glass-card rounded-2xl p-4 shadow-lg animate-float z-20" style={{animationDelay: '1s'}}>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">85% de réussite</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Taux de succès</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Missions Section - Modern cards */}
        <div className="mb-20">
          <div className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 text-purple-700 dark:text-purple-300 rounded-full text-sm font-semibold mb-8 border border-purple-200/50 dark:border-purple-700/50">
              <Target className="h-4 w-4 mr-2" />
              {t('about.values.badge')}
            </div>
            <h2 className="font-display text-display-md text-gray-900 dark:text-white mb-6">
              {t('about.values.title')}
            </h2>
            <p className="text-body-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Des valeurs fortes qui orientent chacune de nos décisions et actions
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {missions.map((mission, index) => (
              <div key={index} className="group card-feature animate-fade-in-scale" style={{animationDelay: `${index * 0.2}s`}}>
                <div className={`w-20 h-20 bg-gradient-to-br ${mission.color} rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300`}>
                  <mission.icon className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 font-display">{mission.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">{mission.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Values Section - Modern gradient */}
        <div className="relative mb-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800"></div>
          <div className="absolute inset-0 bg-black/20"></div>
          
          {/* Animated background elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float"></div>
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float" style={{animationDelay: '2s'}}></div>
          </div>
          
          <div className="relative z-10 p-16 text-center">
            <h2 className="font-display text-display-md text-white mb-12">Ce qui nous guide</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {values.map((value, index) => (
                <div key={index} className="glass-card-dark rounded-2xl p-6 hover:bg-white/20 transition-all duration-300 transform hover:scale-105">
                  <value.icon className="h-8 w-8 text-white mx-auto mb-4" />
                  <p className="font-semibold text-white text-lg">{value.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Testimonials Section with Smart Carousel */}
        <div className="mb-20">
          <div className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/50 dark:to-orange-900/50 text-yellow-700 dark:text-yellow-300 rounded-full text-sm font-semibold mb-8 border border-yellow-200/50 dark:border-yellow-700/50">
              <Star className="h-4 w-4 mr-2" />
              {t('about.testimonials.badge')}
            </div>
            <h2 className="font-display text-display-md text-gray-900 dark:text-white mb-6">
              {t('about.testimonials.title')}
            </h2>
            <p className="text-body-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Des témoignages authentiques de professionnels qui ont réussi grâce à NOMAQbank
            </p>
          </div>
          <div className="animate-fade-in-up" style={{animationDelay: '0.4s'}}>
            <TestimonialsCarousel />
          </div>
        </div>

        {/* CTA Section - Modern design */}
        <div className="animate-fade-in-up">
          <div className="card-modern p-12 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 opacity-50"></div>
            <div className="relative z-10 max-w-3xl mx-auto">
              <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold mb-8 border border-green-200/50 dark:border-green-700/50">
                <Sparkles className="h-4 w-4 mr-2" />
                {t('about.cta.badge')}
              </div>
              <h2 className="font-display text-display-md text-gray-900 dark:text-white mb-6">
                {t('about.cta.title')}
              </h2>
              <p className="text-body-lg text-gray-600 dark:text-gray-300 mb-10 leading-relaxed">
                {t('about.cta.description')}
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-12 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl btn-modern">
                  {t('about.cta.start')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>
                <button className="border-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-12 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 hover:shadow-lg">
                  {t('about.cta.contact')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}