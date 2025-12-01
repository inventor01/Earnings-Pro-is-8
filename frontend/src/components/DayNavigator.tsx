import { useTheme } from '../lib/themeContext';
import { getESTDateString } from '../lib/dateUtils';
import { playButtonClickSound } from '../lib/buttonSoundEffects';
import { useRef, useState } from 'react';

type Period = 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'lastMonth' | 'custom';

interface DayNavigatorProps {
  dayOffset: number;
  onDayOffsetChange: (offset: number) => void;
  label: string;
  period?: Period;
}

export function DayNavigator({ dayOffset, onDayOffsetChange, label, period = 'today' }: DayNavigatorProps) {
  const { config: themeConfig } = useTheme();
  const isDarkTheme = themeConfig.name === 'ninja-dark';
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);

  // Helper to get date range for period
  const getDateRange = () => {
    const today = new Date();
    
    if (period === 'today' || period === 'yesterday') {
      const displayDate = new Date();
      displayDate.setDate(displayDate.getDate() + dayOffset);
      const dateStr = getESTDateString(displayDate.toISOString());
      const [year, month, day] = dateStr.split('-');
      const weekday = displayDate.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = displayDate.toLocaleDateString('en-US', { month: 'short' });
      return {
        startDate: displayDate,
        endDate: displayDate,
        formatSingle: `${weekday}, ${monthName} ${day}`,
        format: `${weekday}, ${monthName} ${day}`
      };
    } else if (period === 'week') {
      const curr = new Date();
      const first = curr.getDate() - curr.getDay();
      const startDate = new Date(curr.setDate(first));
      const endDate = new Date(curr.setDate(first + 6));
      
      const startWD = startDate.toLocaleDateString('en-US', { weekday: 'short' });
      const startMN = startDate.toLocaleDateString('en-US', { month: 'short' });
      const startD = startDate.getDate();
      
      const endWD = endDate.toLocaleDateString('en-US', { weekday: 'short' });
      const endMN = endDate.toLocaleDateString('en-US', { month: 'short' });
      const endD = endDate.getDate();
      
      return {
        startDate,
        endDate,
        formatSingle: '',
        format: `${startWD}, ${startMN} ${startD} - ${endWD}, ${endMN} ${endD}`
      };
    } else if (period === 'last7') {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);
      
      const startWD = startDate.toLocaleDateString('en-US', { weekday: 'short' });
      const startMN = startDate.toLocaleDateString('en-US', { month: 'short' });
      const startD = startDate.getDate();
      
      const endWD = endDate.toLocaleDateString('en-US', { weekday: 'short' });
      const endMN = endDate.toLocaleDateString('en-US', { month: 'short' });
      const endD = endDate.getDate();
      
      return {
        startDate,
        endDate,
        formatSingle: '',
        format: `${startWD}, ${startMN} ${startD} - ${endWD}, ${endMN} ${endD}`
      };
    } else if (period === 'month') {
      const year = today.getFullYear();
      const month = today.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      const startWD = startDate.toLocaleDateString('en-US', { weekday: 'short' });
      const startMN = startDate.toLocaleDateString('en-US', { month: 'short' });
      const startD = startDate.getDate();
      
      const endWD = endDate.toLocaleDateString('en-US', { weekday: 'short' });
      const endMN = endDate.toLocaleDateString('en-US', { month: 'short' });
      const endD = endDate.getDate();
      
      return {
        startDate,
        endDate,
        formatSingle: '',
        format: `${startWD}, ${startMN} ${startD} - ${endWD}, ${endMN} ${endD}`
      };
    } else if (period === 'lastMonth') {
      const now = new Date();
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      const startWD = startDate.toLocaleDateString('en-US', { weekday: 'short' });
      const startMN = startDate.toLocaleDateString('en-US', { month: 'short' });
      const startD = startDate.getDate();
      
      const endWD = endDate.toLocaleDateString('en-US', { weekday: 'short' });
      const endMN = endDate.toLocaleDateString('en-US', { month: 'short' });
      const endD = endDate.getDate();
      
      return {
        startDate,
        endDate,
        formatSingle: '',
        format: `${startWD}, ${startMN} ${startD} - ${endWD}, ${endMN} ${endD}`
      };
    }
    
    return { startDate: today, endDate: today, formatSingle: '', format: '' };
  };

  const dateRange = getDateRange();
  const displayFormat = dateRange.format || dateRange.formatSingle;

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

  const handleDateClick = () => {
    playButtonClickSound();
    setShowDatePicker(true);
    setTimeout(() => datePickerRef.current?.click(), 0);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(e.target.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    const diffTime = selectedDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    onDayOffsetChange(diffDays);
    setShowDatePicker(false);
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
        <div 
          onClick={handleDateClick}
          className="flex-1 text-center min-w-0 select-none py-0.5 md:py-1 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className={`text-xs font-semibold leading-tight ${isDarkTheme ? 'text-gray-500' : 'text-gray-600'}`}>
            {label}
          </div>
          <div className={`text-xs md:text-sm font-bold leading-tight ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'}`}>
            {displayFormat}
          </div>
        </div>
      </div>
      
      {/* Hidden Date Input */}
      <input
        ref={datePickerRef}
        type="date"
        onChange={handleDateChange}
        className="hidden"
        style={{ display: 'none' }}
      />
    </div>
  );
}
