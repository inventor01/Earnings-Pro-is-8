import { useMemo } from 'react';
import { useTheme } from '../lib/themeContext';

interface ProfitCalendarProps {
  entries: any[];
}

export function ProfitCalendar({ entries }: ProfitCalendarProps) {
  const { config: themeConfig } = useTheme();
  const isDarkTheme = themeConfig.name === 'dark-neon';

  const calendarData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const dailyProfits: { [key: string]: number } = {};
    
    entries.forEach(entry => {
      const dateStr = entry.date;
      const amount = entry.amount || 0;
      if (!dailyProfits[dateStr]) {
        dailyProfits[dateStr] = 0;
      }
      if (entry.type === 'ORDER') {
        dailyProfits[dateStr] += amount;
      } else if (entry.type === 'EXPENSE') {
        dailyProfits[dateStr] -= amount;
      }
    });

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day,
        dateStr,
        profit: dailyProfits[dateStr] || 0,
        hasData: !!dailyProfits[dateStr]
      });
    }

    return { days, month: currentMonth, year: currentYear };
  }, [entries]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getColor = (profit: number) => {
    if (profit === 0) return isDarkTheme ? 'bg-slate-700' : 'bg-gray-200';
    if (profit > 0) {
      if (profit > 100) return isDarkTheme ? 'bg-green-700/60' : 'bg-green-200';
      if (profit > 50) return isDarkTheme ? 'bg-green-600/50' : 'bg-green-100';
      return isDarkTheme ? 'bg-green-700/30' : 'bg-green-50';
    } else {
      if (profit < -50) return isDarkTheme ? 'bg-red-700/60' : 'bg-red-200';
      return isDarkTheme ? 'bg-red-700/30' : 'bg-red-50';
    }
  };

  return (
    <div className={`rounded-xl border-2 p-6 transition-all ${
      isDarkTheme
        ? 'bg-gradient-to-br from-slate-800/60 to-slate-900/40 border-cyan-500/30'
        : 'bg-white border-blue-200'
    }`}>
      <h3 className={`text-xl font-bold mb-4 text-center ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>
        {monthNames[calendarData.month]} {calendarData.year}
      </h3>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {dayNames.map(day => (
          <div key={day} className={`text-center text-xs font-bold py-2 ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {calendarData.days.map((dayData, idx) => (
          <div
            key={idx}
            className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
              dayData === null
                ? ''
                : `${getColor(dayData.profit)} ${isDarkTheme ? 'border border-slate-600' : 'border border-gray-300'} hover:scale-105 cursor-pointer`
            }`}
            title={dayData ? `${dayData.day}: $${dayData.profit.toFixed(2)}` : ''}
          >
            {dayData && (
              <div className="text-center">
                <div className={`text-xs ${isDarkTheme ? 'text-slate-300' : 'text-gray-700'}`}>
                  {dayData.day}
                </div>
                {dayData.hasData && (
                  <div className={`text-xs font-black ${dayData.profit > 0 ? (isDarkTheme ? 'text-green-300' : 'text-green-700') : (isDarkTheme ? 'text-red-300' : 'text-red-700')}`}>
                    ${Math.abs(dayData.profit).toFixed(0)}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={`mt-4 pt-4 border-t ${isDarkTheme ? 'border-slate-700' : 'border-gray-300'} text-xs space-y-1`}>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded ${isDarkTheme ? 'bg-green-700/60' : 'bg-green-200'}`}></div>
          <span className={isDarkTheme ? 'text-slate-400' : 'text-gray-600'}>Profitable Day</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded ${isDarkTheme ? 'bg-red-700/30' : 'bg-red-50'}`}></div>
          <span className={isDarkTheme ? 'text-slate-400' : 'text-gray-600'}>Loss Day</span>
        </div>
      </div>
    </div>
  );
}
