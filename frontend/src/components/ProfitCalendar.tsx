import { useState, useMemo } from 'react';
import { useTheme } from '../lib/themeContext';

interface ProfitCalendarProps {
  entries: any[];
}

export function ProfitCalendar({ entries }: ProfitCalendarProps) {
  const { config: themeConfig } = useTheme();
  const isDarkTheme = themeConfig.name === 'dark-neon';
  const [metricView, setMetricView] = useState<'profit' | 'expenses' | 'revenue'>('profit');

  const calendarData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const dailyData: { [key: string]: { profit: number; revenue: number; expenses: number } } = {};
    
    entries.forEach(entry => {
      const dateStr = entry.date;
      const amount = entry.amount || 0;
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { profit: 0, revenue: 0, expenses: 0 };
      }
      if (entry.type === 'ORDER') {
        dailyData[dateStr].revenue += amount;
        dailyData[dateStr].profit += amount;
      } else if (entry.type === 'EXPENSE') {
        dailyData[dateStr].expenses += amount;
        dailyData[dateStr].profit -= amount;
      }
    });

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const data = dailyData[dateStr];
      days.push({
        day,
        dateStr,
        profit: data?.profit || 0,
        revenue: data?.revenue || 0,
        expenses: data?.expenses || 0,
        hasData: !!data
      });
    }

    return { days, month: currentMonth, year: currentYear };
  }, [entries]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getValue = (dayData: any) => {
    if (metricView === 'profit') return dayData.profit;
    if (metricView === 'revenue') return dayData.revenue;
    return dayData.expenses;
  };

  const getColor = (value: number) => {
    // For expenses: lower is better (green), higher is worse (red)
    if (metricView === 'expenses') {
      if (value === 0) return isDarkTheme ? 'bg-slate-700' : 'bg-gray-200';
      if (value > 0) {
        if (value > 100) return isDarkTheme ? 'bg-red-700/60' : 'bg-red-200';
        if (value > 50) return isDarkTheme ? 'bg-red-600/50' : 'bg-red-100';
        return isDarkTheme ? 'bg-red-700/30' : 'bg-red-50';
      }
      return isDarkTheme ? 'bg-slate-700' : 'bg-gray-200';
    }
    
    // For profit and revenue: higher is better (green), lower is worse (red)
    if (value === 0) return isDarkTheme ? 'bg-slate-700' : 'bg-gray-200';
    if (value > 0) {
      if (value > 100) return isDarkTheme ? 'bg-green-700/60' : 'bg-green-200';
      if (value > 50) return isDarkTheme ? 'bg-green-600/50' : 'bg-green-100';
      return isDarkTheme ? 'bg-green-700/30' : 'bg-green-50';
    } else {
      if (value < -50) return isDarkTheme ? 'bg-red-700/60' : 'bg-red-200';
      return isDarkTheme ? 'bg-red-700/30' : 'bg-red-50';
    }
  };

  const getTextColor = (value: number) => {
    if (metricView === 'expenses') {
      return value > 0 ? (isDarkTheme ? 'text-red-300' : 'text-red-700') : (isDarkTheme ? 'text-slate-300' : 'text-gray-700');
    }
    return value > 0 ? (isDarkTheme ? 'text-green-300' : 'text-green-700') : (isDarkTheme ? 'text-red-300' : 'text-red-700');
  };

  return (
    <div className={`rounded-xl border-2 p-6 transition-all ${
      isDarkTheme
        ? 'bg-gradient-to-br from-slate-800/60 to-slate-900/40 border-cyan-500/30'
        : 'bg-white border-blue-200'
    }`}>
      <div className="mb-4 space-y-3">
        <h3 className={`text-xl font-bold text-center ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>
          {monthNames[calendarData.month]} {calendarData.year}
        </h3>
        
        {/* Toggle buttons */}
        <div className="flex gap-2 justify-center flex-wrap">
          <button
            onClick={() => setMetricView('profit')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
              metricView === 'profit'
                ? isDarkTheme
                  ? 'bg-green-500/40 border border-green-400 text-green-300'
                  : 'bg-green-500 text-white border border-green-600'
                : isDarkTheme
                ? 'bg-slate-700/40 border border-slate-600 text-slate-400'
                : 'bg-gray-200 text-gray-600 border border-gray-300'
            }`}
          >
            💰 Profit
          </button>
          <button
            onClick={() => setMetricView('revenue')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
              metricView === 'revenue'
                ? isDarkTheme
                  ? 'bg-blue-500/40 border border-blue-400 text-blue-300'
                  : 'bg-blue-500 text-white border border-blue-600'
                : isDarkTheme
                ? 'bg-slate-700/40 border border-slate-600 text-slate-400'
                : 'bg-gray-200 text-gray-600 border border-gray-300'
            }`}
          >
            📈 Revenue
          </button>
          <button
            onClick={() => setMetricView('expenses')}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
              metricView === 'expenses'
                ? isDarkTheme
                  ? 'bg-orange-500/40 border border-orange-400 text-orange-300'
                  : 'bg-orange-500 text-white border border-orange-600'
                : isDarkTheme
                ? 'bg-slate-700/40 border border-slate-600 text-slate-400'
                : 'bg-gray-200 text-gray-600 border border-gray-300'
            }`}
          >
            💸 Expenses
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {dayNames.map(day => (
          <div key={day} className={`text-center text-xs font-bold py-2 ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {calendarData.days.map((dayData, idx) => {
          const value = dayData ? getValue(dayData) : 0;
          return (
            <div
              key={idx}
              className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                dayData === null
                  ? ''
                  : `${getColor(value)} ${isDarkTheme ? 'border border-slate-600' : 'border border-gray-300'} hover:scale-105 cursor-pointer`
              }`}
              title={dayData ? `${dayData.day}: $${value.toFixed(2)}` : ''}
            >
              {dayData && (
                <div className="text-center">
                  <div className={`text-xs ${isDarkTheme ? 'text-slate-300' : 'text-gray-700'}`}>
                    {dayData.day}
                  </div>
                  {dayData.hasData && (
                    <div className={`text-xs font-black ${getTextColor(value)}`}>
                      ${Math.abs(value).toFixed(0)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={`mt-4 pt-4 border-t ${isDarkTheme ? 'border-slate-700' : 'border-gray-300'} text-xs space-y-1`}>
        {metricView === 'profit' && (
          <>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${isDarkTheme ? 'bg-green-700/60' : 'bg-green-200'}`}></div>
              <span className={isDarkTheme ? 'text-slate-400' : 'text-gray-600'}>Profitable Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${isDarkTheme ? 'bg-red-700/30' : 'bg-red-50'}`}></div>
              <span className={isDarkTheme ? 'text-slate-400' : 'text-gray-600'}>Loss Day</span>
            </div>
          </>
        )}
        {metricView === 'revenue' && (
          <>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${isDarkTheme ? 'bg-green-700/60' : 'bg-green-200'}`}></div>
              <span className={isDarkTheme ? 'text-slate-400' : 'text-gray-600'}>High Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${isDarkTheme ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
              <span className={isDarkTheme ? 'text-slate-400' : 'text-gray-600'}>No Activity</span>
            </div>
          </>
        )}
        {metricView === 'expenses' && (
          <>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${isDarkTheme ? 'bg-red-700/30' : 'bg-red-50'}`}></div>
              <span className={isDarkTheme ? 'text-slate-400' : 'text-gray-600'}>Low Expenses</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${isDarkTheme ? 'bg-red-700/60' : 'bg-red-200'}`}></div>
              <span className={isDarkTheme ? 'text-slate-400' : 'text-gray-600'}>High Expenses</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
