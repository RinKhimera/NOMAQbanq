import { Progress } from '@/components/ui/progress';
import { QuizProgressProps } from '@/types/quiz';

export function QuizProgress({ currentIndex, total, score, isAnswered }: QuizProgressProps) {
  const progress = (currentIndex / total) * 100;
  const scorePercentage = (score / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Question {currentIndex + 1}/{total}</span>
        <span>Score: {score}/{total}</span>
      </div>
      <Progress
        value={progress}
        className={`h-2 ${isAnswered ? 'bg-green-200' : 'bg-blue-200'}`}
      />
      <Progress
        value={scorePercentage}
        className="h-2 bg-green-500"
      />
    </div>
  );
}
