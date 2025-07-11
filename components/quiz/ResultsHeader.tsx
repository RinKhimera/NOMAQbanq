import { ResultsHeaderProps, QUIZ_CONSTANTS } from '@/types/quiz';

export function ResultsHeader({ percentage }: ResultsHeaderProps) {
  // Utilise les bons chemins pour accéder aux constantes
  const getGradient = () => {
    if (percentage >= QUIZ_CONSTANTS.PERFORMANCE.THRESHOLDS.EXCELLENT) {
      return QUIZ_CONSTANTS.GRADIENTS.excellent.base;
    }
    if (percentage >= QUIZ_CONSTANTS.PERFORMANCE.THRESHOLDS.GOOD) {
      return QUIZ_CONSTANTS.GRADIENTS.good.base;
    }
    return QUIZ_CONSTANTS.GRADIENTS.needsWork.base;
  };

  const getMessage = () => {
    if (percentage >= QUIZ_CONSTANTS.PERFORMANCE.THRESHOLDS.EXCELLENT) {
      return 'Excellent !';
    }
    if (percentage >= QUIZ_CONSTANTS.PERFORMANCE.THRESHOLDS.GOOD) {
      return 'Bon travail !';
    }
    return 'Continue tes efforts !';
  };

  return (
    <div className={`bg-gradient-to-r ${getGradient()} p-6 rounded-lg text-white text-center space-y-2`}>
      <h2 className="text-2xl font-bold">{getMessage()}</h2>
      <p className="text-4xl font-bold">{percentage}%</p>
    </div>
  );
}
