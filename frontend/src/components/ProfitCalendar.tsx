import { useState, useMemo } from 'react';
import { useTheme } from '../lib/themeContext';
import { getESTDateString } from '../lib/dateUtils';

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

    // Build aggregated daily data - use map for all possible date formats
    const dailyData: { [key: string]: { profit: number; revenue: number; expenses: number } } = {};
    
    entries.forEach(entry => {
      if (!entry || typeof entry !== 'object') return;
      
      // Try to get date from entry - check multiple possible fields
      let dateStr = '';
      
      if (entry.created_at && typeof entry.created_at === 'string') {
        try {
          dateStr = getESTDateString(entry.created_at);
        } catch (e) {
          console.error('Failed to parse created_at date:', entry.created_at, e);
        }
      }
      
      // Try date field as fallback
      if (!dateStr && entry.date && typeof entry.date === 'string') {
        // Assume date is already in YYYY-MM-DD format or similar
        dateStr = entry.date.substring(0, 10);
      }
      
      if (!dateStr) return;
      
      // Parse amount - ensure it's a number
      let amount = 0;
      if (typeof entry.amount === 'number') {
        amount = entry.amount;
      } else if (typeof entry.amount === 'string') {
        amount = parseFloat(entry.amount) || 0;
      }
      
      // Initialize day data if needed
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { profit: 0, revenue: 0, expenses: 0 };
      }
      
      // Aggregate by type
      const entryType = entry.type ? String(entry.type).toUpperCase().trim() : '';
      
      if (entryType === 'ORDER' || entryType === 'BONUS') {
        dailyData[dateStr].revenue += amount;
        dailyData[dateStr].profit += amount;
      } else if (entryType === 'EXPENSE') {
        // Expenses should always be stored as positive values
        const expenseAmount = Math.abs(amount);
        dailyData[dateStr].expenses += expenseAmount;
        // Subtract expense from profit (use the positive value)
        dailyData[dateStr].profit -= expenseAmount;
      }
    });

    // Build calendar grid
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
        profit: data ? Number(data.profit) || 0 : 0,
        revenue: data ? Number(data.revenue) || 0 : 0,
        expenses: data ? Number(data.expenses) || 0 : 0,
        hasData: !!data
      });
    }

    return { days, month: currentMonth, year: currentYear };
  }, [entries]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getValue = (dayData: any): number => {
    if (!dayData) return 0;
    
    let val = 0;
    if (metricView === 'profit') {
      val = typeof dayData.profit === 'number' ? dayData.profit : 0;
    } else if (metricView === 'revenue') {
      val = typeof dayData.revenue === 'number' ? dayData.revenue : 0;
    } else if (metricView === 'expenses') {
      val = typeof dayData.expenses === 'number' ? dayData.expenses : 0;
    }
    
    return Number(val);
  };

  const getColor = (value: number): string => {
    const numValue = Number(value) || 0;
    
    // For expenses: lower is better (green), higher is worse (red)
    if (metricView === 'expenses') {
      if (numValue === 0) return isDarkTheme ? 'bg-slate-700' : 'bg-gray-200';
      if (numValue > 0) {
        if (numValue > 100) return isDarkTheme ? 'bg-red-700/60' : 'bg-red-200';
        if (numValue > 50) return isDarkTheme ? 'bg-red-600/50' : 'bg-red-100';
        return isDarkTheme ? 'bg-red-700/30' : 'bg-red-50';
      }
      return isDarkTheme ? 'bg-slate-700' : 'bg-gray-200';
    }
    
    // For profit and revenue: higher is better (green), lower is worse (red)
    if (numValue === 0) return isDarkTheme ? 'bg-slate-700' : 'bg-gray-200';
    if (numValue > 0) {
      if (numValue > 100) return isDarkTheme ? 'bg-green-700/60' : 'bg-green-200';
      if (numValue > 50) return isDarkTheme ? 'bg-green-600/50' : 'bg-green-100';
      return isDarkTheme ? 'bg-green-700/30' : 'bg-green-50';
    }
    
    if (numValue < -50) return isDarkTheme ? 'bg-red-700/60' : 'bg-red-200';
    return isDarkTheme ? 'bg-red-700/30' : 'bg-red-50';
  };

  const getTextColor = (value: number): string => {
    const numValue = Number(value) || 0;
    
    if (metricView === 'expenses') {
      return numValue > 0 ? (isDarkTheme ? 'text-red-300' : 'text-red-700') : (isDarkTheme ? 'text-slate-300' : 'text-gray-700');
    }
    return numValue > 0 ? (isDarkTheme ? 'text-green-300' : 'text-green-700') : (isDarkTheme ? 'text-red-300' : 'text-red-700');
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
          const numericValue = Number(value) || 0;
          const color = getColor(numericValue);
          const textColor = getTextColor(numericValue);
          
          return (
            <div
              key={idx}
              className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                dayData === null
                  ? ''
                  : `${color} ${isDarkTheme ? 'border border-slate-600' : 'border border-gray-300'} hover:scale-105 cursor-pointer`
              }`}
              title={dayData ? `${dayData.day}: $${numericValue.toFixed(2)}` : ''}
            >
              {dayData && (
                <div className="text-center">
                  <div className={`text-xs ${isDarkTheme ? 'text-slate-300' : 'text-gray-700'}`}>
                    {dayData.day}
                  </div>
                  {dayData.hasData && (
                    <div className={`text-xs font-black ${textColor}`}>
                      ${numericValue < 0 ? '-' : ''}${Math.abs(numericValue).toFixed(0)}
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
