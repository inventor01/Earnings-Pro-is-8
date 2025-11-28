import { useState, useMemo } from 'react';
import { useTheme } from '../lib/themeContext.tsx';

interface AchievementsProps {
  entries: any[];
  rollup: any;
  monthlyGoal?: any;
}

export function Achievements({ entries, rollup, monthlyGoal }: AchievementsProps) {
  const { config: themeConfig } = useTheme();
  const isDarkTheme = themeConfig.name === 'dark-neon';
  const [expanded, setExpanded] = useState(true);

  const achievements = useMemo(() => {
    if (!entries || !rollup) return { level: 'Beginner', streaks: { green: 0, goal: 0 }, badges: [] };

    // Calculate green day streak (days ending with profit > 0)
    const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let greenStreak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const dayEntries = sortedEntries.filter(e => e.date === dateStr);
      const dayProfit = dayEntries.reduce((sum, e) => {
        if (e.type === 'ORDER') return sum + (e.amount || 0);
        if (e.type === 'EXPENSE') return sum - (e.amount || 0);
        return sum;
      }, 0);
      
      if (dayProfit > 0) {
        greenStreak++;
      } else {
        break;
      }
    }

    // Calculate goal completion streak
    const goalAmount = parseFloat(monthlyGoal?.target_profit || '0');
    let goalStreak = 0;
    if (goalAmount > 0) {
      const monthlyProfit = rollup.profit || 0;
      if (monthlyProfit >= goalAmount) {
        goalStreak = 1; // Current month
      }
    }

    // Calculate total profitable days
    const uniqueDates = new Set(sortedEntries.map(e => e.date));
    let profitableDays = 0;
    uniqueDates.forEach(dateStr => {
      const dayEntries = sortedEntries.filter(e => e.date === dateStr);
      const dayProfit = dayEntries.reduce((sum, e) => {
        if (e.type === 'ORDER') return sum + (e.amount || 0);
        if (e.type === 'EXPENSE') return sum - (e.amount || 0);
        return sum;
      }, 0);
      if (dayProfit > 0) profitableDays++;
    });

    // Determine level based on achievements
    let level = 'Beginner';
    if (greenStreak >= 7) level = 'Hustler';
    if (greenStreak >= 30) level = 'Boss';
    if (greenStreak >= 90) level = 'Legendary';

    // Generate badges
    const badges = [];
    if (greenStreak >= 7) badges.push({ icon: '🔥', label: `${greenStreak}-Day Green Streak!` });
    if (profitableDays >= 10) badges.push({ icon: '💚', label: `${profitableDays} Profitable Days` });
    if (goalStreak > 0) badges.push({ icon: '🎯', label: 'Goal Crushed This Month!' });
    if (profitableDays >= 20) badges.push({ icon: '⭐', label: 'Consistent Earner' });
    if (greenStreak >= 1) badges.push({ icon: '✅', label: 'Started Strong Today' });

    return { level, streaks: { green: greenStreak, goal: goalStreak }, badges, profitableDays };
  }, [entries, rollup, monthlyGoal]);

  if (achievements.badges.length === 0) return null;

  const levelColors = {
    'Beginner': { bg: 'from-blue-600 to-blue-500', text: 'text-blue-300' },
    'Hustler': { bg: 'from-purple-600 to-purple-500', text: 'text-purple-300' },
    'Boss': { bg: 'from-yellow-600 to-orange-500', text: 'text-yellow-300' },
    'Legendary': { bg: 'from-pink-600 to-red-500', text: 'text-pink-300' }
  };

  const colors = levelColors[achievements.level as keyof typeof levelColors] || levelColors['Beginner'];

  return (
    <div className={`rounded-xl border-2 transition-all ${
      isDarkTheme
        ? 'bg-gradient-to-br from-slate-800/60 to-slate-900/40 border-cyan-500/30'
        : 'bg-white border-blue-200'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 md:p-5 flex items-center justify-between hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏆</span>
          <div className="text-left">
            <h3 className={`text-lg md:text-xl font-bold ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>
              Achievements
            </h3>
            <p className={`text-sm ${isDarkTheme ? 'text-slate-400' : 'text-gray-500'}`}>
              Level: <span className={`font-black bg-gradient-to-r ${colors.bg} bg-clip-text text-transparent`}>
                {achievements.level}
              </span>
            </p>
          </div>
        </div>
        <svg className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''} ${isDarkTheme ? 'text-cyan-400' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {expanded && (
        <div className={`px-4 md:px-5 pb-4 md:pb-5 border-t ${isDarkTheme ? 'border-slate-700/50' : 'border-blue-100'}`}>
          {/* Streaks */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className={`p-3 rounded-lg ${isDarkTheme ? 'bg-slate-700/50' : 'bg-blue-50'}`}>
              <div className="text-2xl font-black text-red-500">🔥</div>
              <p className={`text-xs font-bold opacity-75 ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>Green Streak</p>
              <p className={`text-lg font-black ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>{achievements.streaks.green} days</p>
            </div>
            <div className={`p-3 rounded-lg ${isDarkTheme ? 'bg-slate-700/50' : 'bg-blue-50'}`}>
              <div className="text-2xl font-black text-yellow-400">🎯</div>
              <p className={`text-xs font-bold opacity-75 ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>Goals Met</p>
              <p className={`text-lg font-black ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>{achievements.streaks.goal}+ months</p>
            </div>
          </div>

          {/* Badges */}
          <div className="space-y-2">
            <p className={`text-xs font-bold uppercase tracking-wide opacity-60 ${isDarkTheme ? 'text-slate-400' : 'text-gray-500'}`}>Badges</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {achievements.badges.map((badge, idx) => (
                <div
                  key={idx}
                  className={`p-2 md:p-3 rounded-lg text-center transition-all hover:scale-105 ${
                    isDarkTheme
                      ? 'bg-gradient-to-br from-slate-700/60 to-slate-800/40 border border-slate-600/50 hover:border-cyan-400/50'
                      : 'bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 hover:border-blue-400'
                  }`}
                  title={badge.label}
                >
                  <div className="text-2xl mb-1">{badge.icon}</div>
                  <p className={`text-xs font-bold leading-tight ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>
                    {badge.label.split(' ')[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
