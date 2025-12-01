import { useTheme } from '../lib/themeContext';
import { getESTDateString } from '../lib/dateUtils';
import { playButtonClickSound } from '../lib/buttonSoundEffects';

interface DayNavigatorProps {
  dayOffset: number;
  onDayOffsetChange: (offset: number) => void;
  label: string;
}

export function DayNavigator({ dayOffset, onDayOffsetChange, label }: DayNavigatorProps) {
  const { config: themeConfig } = useTheme();
  const isDarkTheme = themeConfig.name === 'ninja-dark';

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

  return (
    <div className={`rounded-xl md:rounded-2xl border-2 p-4 md:p-6 transition-all ${
      isDarkTheme
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-cyan-500/50 shadow-lg shadow-cyan-500/20'
        : 'bg-gradient-to-br from-white to-cyan-50 border-cyan-400 shadow-md shadow-cyan-300/20'
    }`}>
      <div className="flex items-center justify-between gap-3 md:gap-4">
        {/* Previous Day Button */}
        <button
          onClick={handlePrevDay}
          className={`px-3 md:px-4 py-2 md:py-3 rounded-lg font-bold transition-all transform hover:scale-110 active:scale-95 ${
            isDarkTheme
              ? 'bg-cyan-600/40 border border-cyan-500/60 text-cyan-300 hover:bg-cyan-600/60'
              : 'bg-cyan-200 text-cyan-700 border border-cyan-400 hover:bg-cyan-300'
          }`}
          title="Previous day"
        >
          ←
        </button>

        {/* Date Display */}
        <div className="flex-1 text-center">
          <div className={`text-xs md:text-sm font-semibold ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
            {label}
          </div>
          <div className={`text-lg md:text-2xl font-black ${isDarkTheme ? 'text-cyan-300' : 'text-cyan-700'}`}>
            {weekday}, {monthName} {day}
          </div>
          <div className={`text-xs md:text-sm font-medium ${isDarkTheme ? 'text-gray-500' : 'text-gray-500'}`}>
            {year}
          </div>
        </div>

        {/* Next Day Button */}
        <button
          onClick={handleNextDay}
          className={`px-3 md:px-4 py-2 md:py-3 rounded-lg font-bold transition-all transform hover:scale-110 active:scale-95 ${
            isDarkTheme
              ? 'bg-cyan-600/40 border border-cyan-500/60 text-cyan-300 hover:bg-cyan-600/60'
              : 'bg-cyan-200 text-cyan-700 border border-cyan-400 hover:bg-cyan-300'
          }`}
          title="Next day"
        >
          →
        </button>
      </div>

      {/* Today Button */}
      {dayOffset !== 0 && (
        <button
          onClick={handleToday}
          className={`w-full mt-3 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            isDarkTheme
              ? 'bg-yellow-500/40 border border-yellow-500/60 text-yellow-300 hover:bg-yellow-500/60'
              : 'bg-yellow-200 text-yellow-700 border border-yellow-400 hover:bg-yellow-300'
          }`}
        >
          ← Back to Today
        </button>
      )}
    </div>
  );
}
