import { useEffect } from 'react';

interface TimerProps {
  duration: number;
  onTimeUp: () => void;
  isActive: boolean;
}

export default function Timer({ duration, onTimeUp, isActive }: TimerProps) {
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isActive) {
      timer = setTimeout(() => {
        onTimeUp();
      }, duration * 1000);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [duration, isActive, onTimeUp]);

  return (
    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-1000 ease-linear ${
          isActive ? 'w-full' : 'w-0'
        }`}
        style={{
          animation: isActive ? `timer ${duration}s linear forwards` : 'none',
        }}
      />
      <style jsx>{`
        @keyframes timer {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
