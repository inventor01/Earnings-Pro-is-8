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
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate the displayed date
  const displayDate = new Date();
  displayDate.setDate(displayDate.getDate() + dayOffset);
  const dateStr = getESTDateString(displayDate.toISOString());
  const [year, month, day] = dateStr.split('-');
  
  const weekday = displayDate.toLocaleDateString('en-US', { weekday: 'short' });
  const monthName = displayDate.toLocaleDateString('en-US', { month: 'short' });

  // Helper to get date range for period display
  const getDisplayFormat = (): string => {
    if (period === 'today' || period === 'yesterday') {
      return `${weekday}, ${monthName} ${day}`;
    } else if (period === 'week') {
      const curr = new Date();
      const first = curr.getDate() - curr.getDay();
      const startDate = new Date(curr.getFullYear(), curr.getMonth(), first);
      const endDate = new Date(curr.getFullYear(), curr.getMonth(), first + 6);
      
      const startWD = startDate.toLocaleDateString('en-US', { weekday: 'short' });
      const startMN = startDate.toLocaleDateString('en-US', { month: 'short' });
      const startD = startDate.getDate();
      
      const endWD = endDate.toLocaleDateString('en-US', { weekday: 'short' });
      const endMN = endDate.toLocaleDateString('en-US', { month: 'short' });
      const endD = endDate.getDate();
      
      return `${startWD}, ${startMN} ${startD} - ${endWD}, ${endMN} ${endD}`;
    } else if (period === 'last7') {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);
      
      const startWD = startDate.toLocaleDateString('en-US', { weekday: 'short' });
      const startMN = startDate.toLocaleDateString('en-US', { month: 'short' });
      const startD = startDate.getDate();
      
      const endWD = endDate.toLocaleDateString('en-US', { weekday: 'short' });
      const endMN = endDate.toLocaleDateString('en-US', { month: 'short' });
      const endD = endDate.getDate();
      
      return `${startWD}, ${startMN} ${startD} - ${endWD}, ${endMN} ${endD}`;
    } else if (period === 'month') {
      const today = new Date();
      const yr = today.getFullYear();
      const mth = today.getMonth();
      const startDate = new Date(yr, mth, 1);
      const endDate = new Date(yr, mth + 1, 0);
      
      const startWD = startDate.toLocaleDateString('en-US', { weekday: 'short' });
      const startMN = startDate.toLocaleDateString('en-US', { month: 'short' });
      const startD = startDate.getDate();
      
      const endWD = endDate.toLocaleDateString('en-US', { weekday: 'short' });
      const endMN = endDate.toLocaleDateString('en-US', { month: 'short' });
      const endD = endDate.getDate();
      
      return `${startWD}, ${startMN} ${startD} - ${endWD}, ${endMN} ${endD}`;
    } else if (period === 'lastMonth') {
      const now = new Date();
      const yr = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const mth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const startDate = new Date(yr, mth, 1);
      const endDate = new Date(yr, mth + 1, 0);
      
      const startWD = startDate.toLocaleDateString('en-US', { weekday: 'short' });
      const startMN = startDate.toLocaleDateString('en-US', { month: 'short' });
      const startD = startDate.getDate();
      
      const endWD = endDate.toLocaleDateString('en-US', { weekday: 'short' });
      const endMN = endDate.toLocaleDateString('en-US', { month: 'short' });
      const endD = endDate.getDate();
      
      return `${startWD}, ${startMN} ${startD} - ${endWD}, ${endMN} ${endD}`;
    }
    return `${weekday}, ${monthName} ${day}`;
  };

  const displayFormat = getDisplayFormat();

  const handlePrevDay = () => {
    playButtonClickSound();
    onDayOffsetChange(dayOffset - 1);
  };

  const handleNextDay = () => {
    playButtonClickSound();
    onDayOffsetChange(dayOffset + 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (Math.abs(diff) > 30) {
      if (diff > 0) {
        handleNextDay();
      } else {
        handlePrevDay();
      }
    }
    setTouchStart(null);
  };

  const handleDateClick = () => {
    playButtonClickSound();
    setShowCalendar(!showCalendar);
  };

  const handleDateSelect = (selectedDate: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    const diffTime = selectedDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    onDayOffsetChange(diffDays);
    setShowCalendar(false);
  };

  // Generate calendar days
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const calendarDays = [];
  const daysInMonth = getDaysInMonth(calendarMonth);
  const firstDay = getFirstDayOfMonth(calendarMonth);

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i));
  }

  const isSelectedDate = (checkDate: Date | null) => {
    if (!checkDate) return false;
    return checkDate.toDateString() === displayDate.toDateString();
  };

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="cursor-grab active:cursor-grabbing relative"
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

      {/* Calendar Picker */}
      {showCalendar && (
        <div className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 rounded-xl shadow-2xl border-2 p-4 ${
          isDarkTheme 
            ? 'bg-slate-800 border-cyan-400/50' 
            : 'bg-white border-gray-300'
        }`}>
          {/* Month/Year Navigation */}
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
              className={`px-2 py-1 rounded ${isDarkTheme ? 'text-cyan-300 hover:bg-cyan-500/20' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              ←
            </button>
            <div className={`font-bold ${isDarkTheme ? 'text-cyan-300' : 'text-gray-800'}`}>
              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
              className={`px-2 py-1 rounded ${isDarkTheme ? 'text-cyan-300 hover:bg-cyan-500/20' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              →
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className={`text-xs font-bold text-center ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, idx) => (
              <button
                key={idx}
                onClick={() => date && handleDateSelect(date)}
                disabled={!date}
                className={`w-8 h-8 rounded text-sm font-semibold transition-all ${
                  !date 
                    ? 'invisible'
                    : isSelectedDate(date)
                    ? 'bg-lime-500 text-white shadow-lg'
                    : isDarkTheme
                    ? 'text-cyan-300 hover:bg-cyan-500/30'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {date?.getDate()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
