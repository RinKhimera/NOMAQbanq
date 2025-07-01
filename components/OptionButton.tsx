'use client';

import { Button } from '@/components/ui/button';

interface OptionButtonProps {
  option: string;
  index: number;
  isSelected: boolean;
  onClick: (index: number) => void;
  disabled: boolean;
}

export default function OptionButton({ 
  option, 
  index, 
  isSelected, 
  onClick, 
  disabled 
}: OptionButtonProps) {
  const letters = ['A', 'B', 'C', 'D'];

  return (
    <Button
      variant={isSelected ? "default" : "outline"}
      className={`w-full text-left p-6 h-auto justify-start transition-all duration-300 rounded-2xl border-2 ${
        isSelected 
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-blue-600 shadow-xl transform scale-105' 
          : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl hover:transform hover:scale-102'
      } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      onClick={() => onClick(index)}
      disabled={disabled}
    >
      <div className="flex items-start space-x-4 w-full">
        <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-lg transition-all duration-300 ${
          isSelected 
            ? 'bg-white text-blue-600' 
            : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
        }`}>
          {letters[index]}
        </div>
        <span className="flex-1 text-lg leading-relaxed font-medium">{option}</span>
      </div>
    </Button>
  );
}