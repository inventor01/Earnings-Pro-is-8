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
      className="cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center justify-center">
        {/* Date Display - Full Width */}
        <div className="flex-1 text-center min-w-0 select-none py-0.5 md:py-1">
          <div className={`text-xs font-semibold leading-tight ${isDarkTheme ? 'text-gray-500' : 'text-gray-600'}`}>
            {label}
          </div>
          <div className={`text-xs md:text-sm font-bold leading-tight ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
            {weekday}, {monthName} {day}
          </div>
        </div>
      </div>
    </div>
  );
}
