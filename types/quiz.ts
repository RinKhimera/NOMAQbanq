import type { LucideIcon } from 'lucide-react';

// Types d'énumération pour les niveaux de difficulté et de performance
export const enum Difficulty {
  BEGINNER = 'Débutant',
  INTERMEDIATE = 'Intermédiaire',
  ADVANCED = 'Avancé',
}

export const enum PerformanceLevel {
  EXCELLENT = 'Excellent',
  GOOD = 'Bon',
  NEEDS_WORK = 'À améliorer',
}

// État du quiz
export interface QuizState {
  currentQuestionIndex: number;
  selectedOption: number | null;
  isAnswered: boolean;
  score: number;
  isQuizComplete: boolean;
  timerKey: number;
  answers: (number | null)[];
  avgResponseTime?: number;
  lastAnswerTime?: number;
}

// Interfaces pour les composants
export interface FeatureItem {
  icon: LucideIcon;
  text: string;
  description?: string;
}

export interface QuizProgressProps {
  currentIndex: number;
  total: number;
  score: number;
  isAnswered: boolean;
  showTimer?: boolean;
}

export interface ResultsHeaderProps {
  percentage: number;
  level: PerformanceLevel;
  totalQuestions: number;
  correctAnswers: number;
  avgResponseTime?: number;
}

// Constantes liées au quiz
export const QUIZ_CONSTANTS = {
  TIMER: {
    DURATION: 20,
    WARNING_THRESHOLD: 5,
    ANIMATION_DELAY: 2,
  },

  PERFORMANCE: {
    THRESHOLDS: {
      EXCELLENT: 80,
      GOOD: 60,
    },
    MIN_REQUIRED_SCORE: 50,
    TARGET_RESPONSE_TIME: 30, // en secondes
  },

  GRADIENTS: {
    excellent: {
      base: 'from-green-500 to-emerald-600',
      hover: 'from-green-600 to-emerald-700',
      light: 'from-green-400 to-emerald-500',
    },
    good: {
      base: 'from-blue-500 to-indigo-600',
      hover: 'from-blue-600 to-indigo-700',
      light: 'from-blue-400 to-indigo-500',
    },
    needsWork: {
      base: 'from-orange-500 to-red-600',
      hover: 'from-orange-600 to-red-700',
      light: 'from-orange-400 to-red-500',
    },
  },

  ANIMATIONS: {
    fadeIn: 'animate-fade-in-up',
    slideIn: 'animate-slide-in-right',
    pulse: 'animate-pulse',
  },
} as const;

// Fonction utilitaire pour calculer le niveau de performance
export const getPerformanceLevel = (percentage: number): PerformanceLevel => {
  if (percentage >= QUIZ_CONSTANTS.PERFORMANCE.THRESHOLDS.EXCELLENT) {
    return PerformanceLevel.EXCELLENT;
  }
  if (percentage >= QUIZ_CONSTANTS.PERFORMANCE.THRESHOLDS.GOOD) {
    return PerformanceLevel.GOOD;
  }
  return PerformanceLevel.NEEDS_WORK;
};

// Type pour les statistiques de performance
export interface PerformanceStats {
  correctAnswers: number;
  totalQuestions: number;
  percentage: number;
  level: PerformanceLevel;
  avgResponseTime: number;
  completionTime: number;
  dateCompleted: Date;
}
