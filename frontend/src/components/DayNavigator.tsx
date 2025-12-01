import { useTheme } from '../lib/themeContext';
import { getESTDateString } from '../lib/dateUtils';
import { playButtonClickSound } from '../lib/buttonSoundEffects';
import { useRef, useState } from 'react';

interface DayNavigatorProps {
  dayOffset: number;
  onDayOffsetChange: (offset: number) => void;
  label: string;
}

export function DayNavigator({ dayOffset, onDayOffsetChange, label }: DayNavigatorProps) {
  const { config: themeConfig } = useTheme();
  const isDarkTheme = themeConfig.name === 'ninja-dark';
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate the displayed date
  const displayDate = new Date();
  displayDate.setDate(displayDate.getDate() + dayOffset);
  const dateStr = getESTDateString(displayDate.toISOString());
  const [year, month, day] = dateStr.split('-');
  
  const weekday = displayDate.toLocaleDateString('en-US', { weekday: 'short' });
  const monthName = displayDate.toLocaleDateString('en-US', { month: 'short' });

  const handlePrevDay = () => {
    playButtonClickSound();
    onDayOffsetChange(dayOffset - 1);
  };

  const handleNextDay = () => {
    playButtonClickSound();
    onDayOffsetChange(dayOffset + 1);
  };

  const handleToday = () => {
    playButtonClickSound();
    onDayOffsetChange(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (Math.abs(diff) > 30) { // Minimum swipe distance
      if (diff > 0) {
        handleNextDay(); // Swiped left = next day
      } else {
        handlePrevDay(); // Swiped right = previous day
      }
    }
    setTouchStart(null);
  };

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`rounded-md border p-1.5 md:p-2 transition-all ${
        isDarkTheme
          ? 'bg-gray-800/30 border-lime-500/20 hover:border-lime-500/40'
          : 'bg-lime-50/30 border-lime-300/40 hover:border-lime-400/60'
      } cursor-grab active:cursor-grabbing`}
    >
      <div className="flex items-center justify-between gap-1.5">
        {/* Previous Day Button */}
        <button
          onClick={handlePrevDay}
          className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-xs font-semibold transition-all transform hover:scale-105 active:scale-95 ${
            isDarkTheme
              ? 'bg-lime-600/20 text-lime-400 hover:bg-lime-600/40'
              : 'bg-lime-200/50 text-lime-700 hover:bg-lime-300/60'
          }`}
          title="Previous day (swipe right)"
        >
          ←
        </button>

        {/* Date Display */}
        <div className="flex-1 text-center min-w-0 select-none">
          <div className={`text-xs font-semibold ${isDarkTheme ? 'text-gray-500' : 'text-gray-600'}`}>
            {label}
          </div>
          <div className={`text-xs md:text-sm font-bold ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
            {weekday}, {monthName} {day}
          </div>
        </div>

        {/* Next Day Button */}
        <button
          onClick={handleNextDay}
          className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-xs font-semibold transition-all transform hover:scale-105 active:scale-95 ${
            isDarkTheme
              ? 'bg-lime-600/20 text-lime-400 hover:bg-lime-600/40'
              : 'bg-lime-200/50 text-lime-700 hover:bg-lime-300/60'
          }`}
          title="Next day (swipe left)"
        >
          →
        </button>
      </div>

      {/* Today Button */}
      {dayOffset !== 0 && (
        <button
          onClick={handleToday}
          className={`w-full mt-1 px-2 py-0.5 rounded text-xs font-semibold transition-all ${
            isDarkTheme
              ? 'bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/30'
              : 'bg-yellow-200/30 text-yellow-700 hover:bg-yellow-300/50'
          }`}
        >
          ← Back to Today
        </button>
      )}
    </div>
  );
}
