'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface TimerProps {
  duration: number;
  onTimeUp: () => void;
  isActive: boolean;
  onReset?: () => void;
}

export default function Timer({ duration, onTimeUp, isActive, onReset }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (onReset) {
      setTimeLeft(duration);
    }
  }, [onReset, duration]);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeLeft, onTimeUp]);

  const progress = ((duration - timeLeft) / duration) * 100;
  const isUrgent = timeLeft <= 5;
  const isCritical = timeLeft <= 3;

  return (
    <div className={`card-modern p-6 transition-all duration-300 ${
      isCritical 
        ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-600 shadow-xl animate-pulse' 
        : isUrgent 
        ? 'bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-600 shadow-lg' 
        : 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700'
    }`}>
      <div className="flex items-center space-x-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ${
          isCritical 
            ? 'bg-gradient-to-br from-red-500 to-red-600 animate-pulse' 
            : isUrgent 
            ? 'bg-gradient-to-br from-orange-500 to-orange-600' 
            : 'bg-gradient-to-br from-blue-500 to-indigo-600'
        }`}>
          {isUrgent ? (
            <AlertTriangle className="h-8 w-8 text-white" />
          ) : (
            <Clock className="h-8 w-8 text-white" />
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isUrgent ? 'Attention ! Temps limité' : 'Temps restant'}
            </h3>
            <div className="text-right">
              <span className={`text-3xl font-bold transition-all duration-300 ${
                isCritical 
                  ? 'text-red-600 dark:text-red-400' 
                  : isUrgent 
                  ? 'text-orange-600 dark:text-orange-400' 
                  : 'text-blue-600 dark:text-blue-400'
              }`}>
                {timeLeft}
              </span>
              <span className="text-lg text-gray-600 dark:text-gray-400 ml-1">s</span>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden shadow-inner">
            <div
              className={`h-4 rounded-full transition-all duration-1000 ease-out shadow-lg ${
                isCritical 
                  ? 'bg-gradient-to-r from-red-500 to-red-600' 
                  : isUrgent 
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600' 
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Time indicators */}
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">0s</span>
            <span className={`font-medium ${
              isUrgent ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
            }`}>
              {isUrgent ? 'Dépêchez-vous !' : 'Prenez votre temps'}
            </span>
            <span className="text-gray-600 dark:text-gray-400">{duration}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}