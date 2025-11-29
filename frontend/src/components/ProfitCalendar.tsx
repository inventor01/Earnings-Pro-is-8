import { useState, useMemo } from 'react';
import { useTheme } from '../lib/themeContext';
import { getESTDateString } from '../lib/dateUtils';

interface ProfitCalendarProps {
  entries: any[];
  onDayClick?: (dateStr: string) => void;
  selectedDateStr?: string;
}

export function ProfitCalendar({ entries, onDayClick, selectedDateStr }: ProfitCalendarProps) {
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
      
      // ALWAYS use timestamp first - it's the authoritative UTC field from backend
      if (entry.timestamp && typeof entry.timestamp === 'string') {
        try {
          // Ensure timestamp is in ISO format
          let ts = entry.timestamp;
          // Handle timestamps without Z suffix
          if (!ts.includes('Z') && !ts.includes('+')) {
            ts = ts + 'Z'; // Assume UTC if no timezone
          }
          dateStr = getESTDateString(ts);
        } catch (e) {
          console.error('Failed to parse timestamp:', entry.timestamp, e);
        }
      }
      
      // Try created_at as fallback only if timestamp failed
      if (!dateStr && entry.created_at && typeof entry.created_at === 'string') {
        try {
          let ts = entry.created_at;
          if (!ts.includes('Z') && !ts.includes('+')) {
            ts = ts + 'Z';
          }
          dateStr = getESTDateString(ts);
        } catch (e) {
          console.error('Failed to parse created_at date:', entry.created_at, e);
        }
      }
      
      // Try date field as last fallback only
      if (!dateStr && entry.date && typeof entry.date === 'string') {
        // Assume date is already in YYYY-MM-DD format or similar
        dateStr = entry.date.substring(0, 10);
      }
      
      if (!dateStr) {
        console.warn('Could not determine date for entry:', entry);
        return;
      }
      
      // Parse amount - ensure it's a number and properly rounded
      let amount = 0;
      if (typeof entry.amount === 'number') {
        amount = Math.round(entry.amount * 100) / 100; // Round to 2 decimals
      } else if (typeof entry.amount === 'string') {
        amount = Math.round(parseFloat(entry.amount) * 100) / 100 || 0;
      }
      
      // Initialize day data if needed
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { profit: 0, revenue: 0, expenses: 0 };
      }
      
      // Backend stores expenses as negative amounts
      // Match backend logic: profit = total_amount, revenue = positive amounts, expenses = abs(negative amounts)
      if (amount > 0) {
        dailyData[dateStr].revenue = Math.round((dailyData[dateStr].revenue + amount) * 100) / 100;
      } else if (amount < 0) {
        dailyData[dateStr].expenses = Math.round((dailyData[dateStr].expenses + Math.abs(amount)) * 100) / 100;
      }
      
      // Profit is the sum of all amounts (positive revenue + negative expenses)
      dailyData[dateStr].profit = Math.round((dailyData[dateStr].profit + amount) * 100) / 100;
    });

    // Build calendar grid
    type CalendarDay = {
      day: number;
      dateStr: string;
      profit: number;
      revenue: number;
      expenses: number;
      hasData: boolean;
    } | null;
    const days: CalendarDay[] = [];
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
    <div className={`rounded-2xl border-2 p-6 transition-all shadow-2xl ${
      isDarkTheme
        ? 'bg-gradient-to-br from-slate-800/80 via-slate-900/60 to-slate-950/80 border-lime-500/40 shadow-xl shadow-lime-500/10'
        : 'bg-gradient-to-br from-white to-lime-50 border-lime-400 shadow-lg shadow-lime-300/20'
    }`}>
      <div className="mb-4 space-y-3">
        <h3 className={`text-2xl font-black text-center ${isDarkTheme ? 'text-yellow-400' : 'text-green-900'} drop-shadow-lg`}>
          {monthNames[calendarData.month]} {calendarData.year}
        </h3>
        
        {/* Toggle buttons */}
        <div className="flex gap-2 justify-center flex-wrap">
          <button
            onClick={() => setMetricView('profit')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all transform hover:scale-105 shadow-md ${
              metricView === 'profit'
                ? isDarkTheme
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 border-2 border-yellow-600 text-black shadow-lg shadow-yellow-400/50'
                  : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black border-2 border-yellow-600 shadow-lg shadow-yellow-400/40'
                : isDarkTheme
                ? 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-600/50'
                : 'bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300'
            }`}
          >
            💰 Profit
          </button>
          <button
            onClick={() => setMetricView('revenue')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all transform hover:scale-105 shadow-md ${
              metricView === 'revenue'
                ? isDarkTheme
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 border-2 border-yellow-600 text-black shadow-lg shadow-yellow-400/50'
                  : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black border-2 border-yellow-600 shadow-lg shadow-yellow-400/40'
                : isDarkTheme
                ? 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-600/50'
                : 'bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300'
            }`}
          >
            📈 Revenue
          </button>
          <button
            onClick={() => setMetricView('expenses')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all transform hover:scale-105 shadow-md ${
              metricView === 'expenses'
                ? isDarkTheme
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 border-2 border-yellow-600 text-black shadow-lg shadow-yellow-400/50'
                  : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black border-2 border-yellow-600 shadow-lg shadow-yellow-400/40'
                : isDarkTheme
                ? 'bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-600/50'
                : 'bg-gray-200 text-gray-700 border border-gray-300 hover:bg-gray-300'
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
          const isSelected = dayData?.dateStr === selectedDateStr;
          
          return (
            <button
              key={idx}
              onClick={() => dayData && onDayClick?.(dayData.dateStr)}
              disabled={dayData === null}
              className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all transform ${
                dayData === null
                  ? 'cursor-default'
                  : isSelected
                  ? `bg-gradient-to-br from-yellow-300 to-yellow-500 border-2 border-yellow-700 text-black hover:scale-110 active:scale-100 cursor-pointer ring-2 ring-yellow-200 ring-offset-2 shadow-xl shadow-yellow-400/60 animate-pulse`
                  : `${color} ${isDarkTheme ? 'border border-slate-600 hover:shadow-md hover:shadow-slate-500/30' : 'border border-gray-300 hover:shadow-md hover:shadow-gray-300/40'} hover:scale-105 active:scale-100 cursor-pointer transition-shadow`
              }`}
              title={dayData ? `${dayData.day}: $${numericValue.toFixed(2)}${isSelected ? ' (selected)' : ''}` : ''}
            >
              {dayData && (
                <div className="text-center">
                  <div className={`text-xs ${isSelected ? 'text-black font-black' : isDarkTheme ? 'text-slate-300' : 'text-gray-700'}`}>
                    {dayData.day}
                  </div>
                  {dayData.hasData && (
                    <div className={`text-xs font-black ${isSelected ? 'text-black' : textColor}`}>
                      {'$' + (numericValue < 0 ? '-' : '') + Math.abs(numericValue).toFixed(0)}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className={`mt-6 pt-4 border-t-2 ${isDarkTheme ? 'border-lime-500/30' : 'border-lime-400'} text-xs space-y-1`}>
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
