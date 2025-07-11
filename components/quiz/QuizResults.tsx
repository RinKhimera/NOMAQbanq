import { Button } from '@/components/ui/button';
import { ResultsHeader } from '@/components/quiz/ResultsHeader';
import Link from 'next/link';
import {
  Award,
  TrendingUp,
  Target,
  BookOpen,
  ArrowRight,
  Sparkles,
  Crown,
  Star,
  Users,
  Clock,
  BarChart3,
  CheckCircle
} from 'lucide-react';
import { PerformanceLevel, QUIZ_CONSTANTS } from '@/types/quiz';

// Types
interface QuizResultsProps {
  score: number;
  totalQuestions: number;
  avgResponseTime?: number;
  onRestart: () => void;
  isAuthenticated: boolean;
}

interface Feature {
  icon: typeof BookOpen;
  text: string;
  value?: string;
  description?: string;
}

const FEATURES: Feature[] = [
  { icon: BookOpen, text: 'Questions', value: '2270+', description: 'Questions médicales vérifiées' },
  { icon: Users, text: 'Candidats', value: '4000+', description: 'Utilisateurs actifs' },
  { icon: Clock, text: 'Disponibilité', value: '24/7', description: 'Accès illimité' },
  { icon: BarChart3, text: 'Progression', description: 'Suivi détaillé de vos progrès' }
];

export function QuizResults({
  score,
  totalQuestions,
  avgResponseTime,
  onRestart,
  isAuthenticated
}: QuizResultsProps) {
  const percentage = Math.round((score / totalQuestions) * 100);
  const level = percentage >= QUIZ_CONSTANTS.PERFORMANCE.THRESHOLDS.EXCELLENT
    ? PerformanceLevel.EXCELLENT
    : percentage >= QUIZ_CONSTANTS.PERFORMANCE.THRESHOLDS.GOOD
    ? PerformanceLevel.GOOD
    : PerformanceLevel.NEEDS_WORK;

  const gradient = QUIZ_CONSTANTS.GRADIENTS[level === PerformanceLevel.EXCELLENT 
    ? 'excellent' 
    : level === PerformanceLevel.GOOD 
    ? 'good' 
    : 'needsWork'].base;

  return (
    <div className="max-w-5xl mx-auto">
      <ResultsHeader 
        percentage={percentage} 
        level={level} 
        totalQuestions={totalQuestions}
        correctAnswers={score}
        avgResponseTime={avgResponseTime}
      />

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <ScoreCard 
          percentage={percentage}
          score={score}
          totalQuestions={totalQuestions}
          level={level}
          gradient={gradient}
        />
        <PerformanceCard 
          percentage={percentage}
          avgResponseTime={avgResponseTime}
          level={level}
          gradient={gradient}
        />
        <RecommendationsCard level={level} />
      </div>

      {!isAuthenticated && <CallToAction onRestart={onRestart} features={FEATURES} />}

      <div className="flex flex-col sm:flex-row gap-6 justify-center">
        <Button onClick={onRestart} className="btn-gradient">
          Recommencer l&apos;évaluation
        </Button>
        <Link href="/domaines">
          <Button variant="outline" className="btn-outline">
            Explorer les domaines
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ScoreCard({ percentage, score, totalQuestions, level, gradient }: { 
  percentage: number;
  score: number;
  totalQuestions: number;
  level: PerformanceLevel;
  gradient: string;
}) {
  return (
    <div className="card-modern p-8 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 opacity-50" />
      <div className="relative z-10">
        <div className={`w-20 h-20 bg-gradient-to-br ${gradient} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl`}>
          {level === PerformanceLevel.EXCELLENT ? (
            <Crown className="h-10 w-10 text-white" />
          ) : (
            <Award className="h-10 w-10 text-white" />
          )}
        </div>
        <p className="text-5xl font-bold text-gray-900 dark:text-white mb-2 font-display">{percentage}%</p>
        <p className="text-gray-600 dark:text-gray-300 font-semibold text-lg">Score final</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{score} / {totalQuestions} bonnes réponses</p>
      </div>
    </div>
  );
}

function PerformanceCard({ percentage, avgResponseTime, level, gradient }: {
  percentage: number;
  avgResponseTime?: number;
  level: PerformanceLevel;
  gradient: string;
}) {
  return (
    <div className="card-modern p-8">
      <div className="flex items-center space-x-4 mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
          <TrendingUp className="h-8 w-8 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white font-display">Analyse</h3>
          <p className="text-gray-600 dark:text-gray-300">Votre performance</p>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Précision</span>
          <span className={`font-bold ${gradient}`}>{percentage}%</span>
        </div>
        {avgResponseTime && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Temps moyen</span>
            <span className="font-bold text-gray-900 dark:text-white">
              {Math.round(avgResponseTime)}s/question
            </span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Niveau</span>
          <span className={`font-bold ${gradient}`}>{level}</span>
        </div>
      </div>
    </div>
  );
}

function RecommendationsCard({ level }: { level: PerformanceLevel }) {
  return (
    <div className="card-modern p-8">
      <div className="flex items-center space-x-4 mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
          <Target className="h-8 w-8 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white font-display">Recommandations</h3>
          <p className="text-gray-600 dark:text-gray-300">Prochaines étapes</p>
        </div>
      </div>
      <div className="space-y-3">
        <RecommendationsList level={level} />
      </div>
    </div>
  );
}

function RecommendationsList({ level }: { level: PerformanceLevel }) {
  const recommendations = {
    [PerformanceLevel.EXCELLENT]: [
      { icon: CheckCircle, text: 'Maintenez ce niveau', color: 'text-green-500' },
      { icon: CheckCircle, text: 'Pratiquez les cas complexes', color: 'text-green-500' },
      { icon: CheckCircle, text: 'Révisez les détails fins', color: 'text-green-500' },
    ],
    [PerformanceLevel.GOOD]: [
      { icon: Target, text: 'Renforcez les bases', color: 'text-blue-500' },
      { icon: Target, text: 'Pratiquez plus régulièrement', color: 'text-blue-500' },
      { icon: Target, text: 'Focalisez sur vos faiblesses', color: 'text-blue-500' },
    ],
    [PerformanceLevel.NEEDS_WORK]: [
      { icon: BookOpen, text: 'Révisez les concepts de base', color: 'text-orange-500' },
      { icon: BookOpen, text: 'Utilisez nos modules guidés', color: 'text-orange-500' },
      { icon: BookOpen, text: 'Pratiquez quotidiennement', color: 'text-orange-500' },
    ],
  };

  return (
    <>
      {recommendations[level].map((rec, index) => (
        <div key={index} className="flex items-center space-x-2">
          <rec.icon className={`h-4 w-4 ${rec.color}`} />
          <span className="text-sm text-gray-700 dark:text-gray-300">{rec.text}</span>
        </div>
      ))}
    </>
  );
}

function CallToAction({ onRestart, features }: { onRestart: () => void; features: Feature[] }) {
  return (
    <div className="relative mb-12 overflow-hidden rounded-3xl">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800" />
      <div className="absolute inset-0 bg-black/20" />
      
      {/* Éléments d'arrière-plan animés */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-white/10 rounded-full blur-2xl animate-float" />
        <div 
          className="absolute -bottom-20 -right-20 w-48 h-48 bg-white/10 rounded-full blur-2xl animate-float" 
          style={{animationDelay: '2s'}}
        />
      </div>
      
      <div className="relative z-10 p-12 text-center">
        <div className="inline-flex items-center px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-full text-sm font-semibold mb-8 border border-white/30">
          <Sparkles className="h-4 w-4 mr-2" />
          Débloquez votre potentiel
        </div>
        <h2 className="font-display text-4xl font-bold text-white mb-6">
          Prêt à passer au niveau supérieur ?
        </h2>
        <p className="text-xl text-blue-100 mb-10 max-w-3xl mx-auto leading-relaxed">
          Accédez à plus de ressources, des explications détaillées, des modules spécialisés 
          et un suivi personnalisé de vos progrès.
        </p>
        
        {/* Grille de fonctionnalités */}
        <div className="grid md:grid-cols-4 gap-6 mb-10 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <div key={index} className="glass-card-dark rounded-xl p-4 hover:bg-white/20 transition-all duration-300">
              <feature.icon className="h-6 w-6 text-white mx-auto mb-2" />
              <p className="text-white text-sm font-medium">
                {feature.value && <span className="block text-lg font-bold mb-1">{feature.value}</span>}
                {feature.text}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Link href="/inscription" className="group">
            <Button className="btn-gradient group-hover:scale-105">
              Créer mon compte gratuit
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Button 
            onClick={onRestart}
            variant="outline" 
            className="btn-outline-white"
          >
            Refaire le test
          </Button>
        </div>

        {/* Indicateurs de confiance */}
        <div className="flex items-center justify-center space-x-8 mt-10 pt-8 border-t border-white/20">
          <div className="flex items-center space-x-2">
            <div className="flex -space-x-2">
              {[1,2,3,4].map((i) => (
                <div key={i} className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full border-2 border-white/30" />
              ))}
            </div>
            <div className="ml-3">
              <div className="flex items-center space-x-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3 w-3 text-yellow-300 fill-current" />
                ))}
              </div>
              <p className="text-xs text-blue-200">4000+ candidats satisfaits</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">85%</p>
            <p className="text-xs text-blue-200">Taux de réussite</p>
          </div>
        </div>
      </div>
    </div>
  );
}
