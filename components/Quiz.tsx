'use client';

import { useState, useEffect } from 'react';
import { Question, mockQuestions } from '@/data/questions';
import Timer from './Timer';
import OptionButton from './OptionButton';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Award, TrendingUp, Target, BookOpen, ArrowRight, Sparkles, Crown, Star, Users, Clock, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function Quiz() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  const currentQuestion = mockQuestions[currentQuestionIndex];
  const totalQuestions = mockQuestions.length;

  useEffect(() => {
    setAnswers(new Array(totalQuestions).fill(null));
  }, [totalQuestions]);

  const handleOptionSelect = (optionIndex: number) => {
    if (isAnswered) return;
    setSelectedOption(optionIndex);
  };

  const handleTimeUp = () => {
    if (!isAnswered) {
      setIsAnswered(true);
    }
  };

  const handleNext = () => {
    // Save the answer
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = selectedOption;
    setAnswers(newAnswers);

    if (selectedOption !== null && selectedOption === currentQuestion.correctAnswer) {
      setScore(score + 1);
    }

    if (currentQuestionIndex + 1 < totalQuestions) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setTimerKey(prev => prev + 1);
    } else {
      setIsQuizComplete(true);
    }
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsQuizComplete(false);
    setTimerKey(prev => prev + 1);
    setAnswers(new Array(totalQuestions).fill(null));
  };

  if (isQuizComplete) {
    const percentage = Math.round((score / totalQuestions) * 100);
    const isExcellent = percentage >= 80;
    const isGood = percentage >= 60;
    
    return (
      <div className="max-w-5xl mx-auto">
        {/* Results Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold mb-8 border border-green-200/50 dark:border-green-700/50">
            <Award className="h-4 w-4 mr-2" />
            Évaluation terminée
          </div>
          <h2 className="font-display text-display-md text-gray-900 dark:text-white mb-6">
            {isExcellent ? 'Excellent travail !' : isGood ? 'Bon travail !' : 'Continuez vos efforts !'}
          </h2>
          <p className="text-body-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {isExcellent 
              ? 'Vous maîtrisez très bien les concepts. Vous êtes sur la bonne voie pour réussir l\'EACMC !'
              : isGood 
              ? 'Vous avez de bonnes bases. Quelques révisions ciblées vous aideront à atteindre l\'excellence.'
              : 'Il y a de la place pour l\'amélioration. Une préparation structurée vous aidera à progresser rapidement.'
            }
          </p>
        </div>

        {/* Results Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Score Card */}
          <div className="card-modern p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 opacity-50"></div>
            <div className="relative z-10">
              <div className={`w-20 h-20 bg-gradient-to-br ${isExcellent ? 'from-green-500 to-emerald-600' : isGood ? 'from-blue-500 to-indigo-600' : 'from-orange-500 to-red-600'} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl`}>
                {isExcellent ? <Crown className="h-10 w-10 text-white" /> : <Award className="h-10 w-10 text-white" />}
              </div>
              <p className="text-5xl font-bold text-gray-900 dark:text-white mb-2 font-display">{percentage}%</p>
              <p className="text-gray-600 dark:text-gray-300 font-semibold text-lg">Score final</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{score} / {totalQuestions} bonnes réponses</p>
            </div>
          </div>

          {/* Performance Analysis */}
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
                <span className={`font-bold ${isExcellent ? 'text-green-600' : isGood ? 'text-blue-600' : 'text-orange-600'}`}>{percentage}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Temps moyen</span>
                <span className="font-bold text-gray-900 dark:text-white">18s/question</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Niveau</span>
                <span className={`font-bold ${isExcellent ? 'text-green-600' : isGood ? 'text-blue-600' : 'text-orange-600'}`}>
                  {isExcellent ? 'Avancé' : isGood ? 'Intermédiaire' : 'Débutant'}
                </span>
              </div>
            </div>
          </div>

          {/* Recommendations */}
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
              {isExcellent ? (
                <>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Maintenez ce niveau</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Pratiquez les cas complexes</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Révisez les détails fins</span>
                  </div>
                </>
              ) : isGood ? (
                <>
                  <div className="flex items-center space-x-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Renforcez les bases</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Pratiquez plus régulièrement</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Focalisez sur vos faiblesses</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Révisez les concepts de base</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Utilisez nos modules guidés</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Pratiquez quotidiennement</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Call to Action Section */}
        <div className="relative mb-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800"></div>
          <div className="absolute inset-0 bg-black/20"></div>
          
          {/* Animated background elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-white/10 rounded-full blur-2xl animate-float"></div>
            <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-white/10 rounded-full blur-2xl animate-float" style={{animationDelay: '2s'}}></div>
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
              Accédez à plus de 2270 questions, des explications détaillées, des modules spécialisés 
              et un suivi personnalisé de vos progrès. Rejoignez les 4000+ candidats qui nous font confiance.
            </p>
            
            {/* Features Grid */}
            <div className="grid md:grid-cols-4 gap-6 mb-10 max-w-4xl mx-auto">
              {[
                { icon: BookOpen, text: '2270+ Questions' },
                { icon: Users, text: '4000+ Candidats' },
                { icon: Clock, text: 'Accès 24/7' },
                { icon: BarChart3, text: 'Suivi détaillé' }
              ].map((feature, index) => (
                <div key={index} className="glass-card-dark rounded-xl p-4 hover:bg-white/20 transition-all duration-300">
                  <feature.icon className="h-6 w-6 text-white mx-auto mb-2" />
                  <p className="text-white text-sm font-medium">{feature.text}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link href="/inscription">
                <Button className="bg-white text-blue-600 hover:bg-blue-50 px-12 py-4 text-lg h-auto font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 btn-modern">
                  Créer mon compte gratuit
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button 
                onClick={restartQuiz}
                variant="outline" 
                className="border-2 border-white/30 text-white hover:bg-white/10 px-12 py-4 text-lg h-auto rounded-2xl font-semibold transition-all duration-300 glass-card-dark"
              >
                Refaire le test
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center justify-center space-x-8 mt-10 pt-8 border-t border-white/20">
              <div className="flex items-center space-x-2">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full border-2 border-white/30"></div>
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Button 
            onClick={restartQuiz}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-4 text-lg h-auto rounded-2xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 btn-modern"
          >
            Recommencer l'évaluation
          </Button>
          <Link href="/domaines">
            <Button 
              variant="outline"
              className="border-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-10 py-4 text-lg h-auto rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg"
            >
              Explorer les domaines
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Progress Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                Question {currentQuestionIndex + 1} sur {totalQuestions}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Score actuel: {score}/{currentQuestionIndex + (isAnswered ? 1 : 0)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {Math.round(((currentQuestionIndex + (isAnswered ? 1 : 0)) / totalQuestions) * 100)}%
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Progression</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
          <div
            className="h-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out shadow-lg"
            style={{ width: `${((currentQuestionIndex + (isAnswered ? 1 : 0)) / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Timer */}
      <div className="mb-8">
        <Timer
          key={timerKey}
          duration={20}
          onTimeUp={handleTimeUp}
          isActive={!isAnswered}
          onReset={undefined}
        />
      </div>

      {/* Question Card */}
      <div className="card-modern overflow-hidden shadow-2xl mb-8">
        {/* Question Image */}
        <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 relative overflow-hidden">
          <img
            src={currentQuestion.imageSrc}
            alt="Question médicale"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
          
          {/* Question Number Badge */}
          <div className="absolute top-6 left-6">
            <div className="glass-card rounded-xl px-4 py-2 shadow-lg">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Question {currentQuestionIndex + 1}
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-8">
          {/* Question Text */}
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-8 leading-relaxed">
            {currentQuestion.question}
          </h2>
          
          {/* Options */}
          <div className="space-y-4 mb-8">
            {currentQuestion.options.map((option, index) => (
              <OptionButton
                key={index}
                option={option}
                index={index}
                isSelected={selectedOption === index}
                onClick={handleOptionSelect}
                disabled={isAnswered}
              />
            ))}
          </div>

          {/* Explanation */}
          {isAnswered && (
            <div className="animate-fade-in-up">
              <div className={`p-6 rounded-2xl border-2 ${
                selectedOption === currentQuestion.correctAnswer 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
              }`}>
                <div className="flex items-start space-x-4 mb-4">
                  {selectedOption === currentQuestion.correctAnswer ? (
                    <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <XCircle className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <div>
                    <p className={`text-xl font-bold mb-2 ${
                      selectedOption === currentQuestion.correctAnswer ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                    }`}>
                      {selectedOption === currentQuestion.correctAnswer ? 'Excellente réponse !' : 'Réponse incorrecte'}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Next Button */}
          <div className="flex justify-end mt-8">
            <Button
              onClick={handleNext}
              disabled={selectedOption === null && !isAnswered}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-4 text-lg h-auto rounded-2xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 btn-modern disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {currentQuestionIndex + 1 === totalQuestions ? 'Voir les résultats' : 'Question suivante'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}