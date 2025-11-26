import { useMemo } from 'react';
import { useTheme } from '../lib/themeContext';

interface AchievementsModalProps {
  entries: any[];
  rollup: any;
  monthlyGoal?: any;
  onClose: () => void;
}

export function AchievementsModal({ entries, rollup, monthlyGoal, onClose }: AchievementsModalProps) {
  const { config: themeConfig } = useTheme();
  const isDarkTheme = themeConfig.name === 'dark-neon';

  const achievements = useMemo(() => {
    if (!entries || !rollup) return { level: 'Beginner', streaks: { green: 0, goal: 0 }, allBadges: [] };

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

    const goalAmount = parseFloat(monthlyGoal?.target_profit || '0');
    let goalStreak = 0;
    if (goalAmount > 0 && (rollup.profit || 0) >= goalAmount) {
      goalStreak = 1;
    }

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

    let level = 'Beginner';
    if (greenStreak >= 7) level = 'Hustler';
    if (greenStreak >= 30) level = 'Boss';
    if (greenStreak >= 90) level = 'Legendary';

    const allBadges = [
      { icon: '✅', label: 'Started Strong Today', unlocked: profitableDays >= 1, condition: 'End day green' },
      { icon: '💚', label: 'Consistent Earner', unlocked: profitableDays >= 10, condition: '10 profitable days' },
      { icon: '🔥', label: '7-Day Green Streak', unlocked: greenStreak >= 7, condition: 'End 7 days green' },
      { icon: '⭐', label: 'Week Champion', unlocked: greenStreak >= 7, condition: 'Complete a green week' },
      { icon: '👑', label: 'Month Master', unlocked: greenStreak >= 30, condition: 'Complete a green month' },
      { icon: '🎯', label: 'Goal Crusher', unlocked: goalStreak > 0, condition: 'Reach monthly goal' },
      { icon: '🚀', label: 'Legendary', unlocked: greenStreak >= 90, condition: '90-day streak' },
    ];

    return { level, streaks: { green: greenStreak, goal: goalStreak }, allBadges, profitableDays };
  }, [entries, rollup, monthlyGoal]);

  const levelColors = {
    'Beginner': { bg: 'from-blue-600 to-blue-500', glow: 'shadow-blue-500/50', border: 'border-blue-500' },
    'Hustler': { bg: 'from-purple-600 to-purple-500', glow: 'shadow-purple-500/50', border: 'border-purple-500' },
    'Boss': { bg: 'from-yellow-600 to-orange-500', glow: 'shadow-yellow-500/50', border: 'border-yellow-500' },
    'Legendary': { bg: 'from-pink-600 to-red-500', glow: 'shadow-pink-500/50', border: 'border-pink-500' }
  };

  const colors = levelColors[achievements.level as keyof typeof levelColors] || levelColors['Beginner'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`rounded-2xl max-w-2xl w-full max-h-96 overflow-y-auto ${
        isDarkTheme
          ? 'bg-gradient-to-br from-slate-900 to-slate-800 border border-cyan-500/30'
          : 'bg-white border border-blue-300'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 flex items-center justify-between p-6 border-b ${
          isDarkTheme ? 'border-slate-700 bg-slate-900/80' : 'border-blue-200 bg-white/80'
        } backdrop-blur-sm`}>
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏆</span>
            <div>
              <h2 className={`text-2xl font-black ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>
                Achievements
              </h2>
              <p className={`text-sm ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
                Level: <span className={`font-black bg-gradient-to-r ${colors.bg} bg-clip-text text-transparent`}>
                  {achievements.level}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all ${
              isDarkTheme
                ? 'hover:bg-slate-700 text-cyan-400'
                : 'hover:bg-blue-100 text-blue-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${isDarkTheme ? 'bg-slate-800/60 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
              <div className="text-3xl font-black text-red-500 mb-1">🔥</div>
              <p className={`text-xs font-bold opacity-75 ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>Green Streak</p>
              <p className={`text-2xl font-black ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>{achievements.streaks.green}</p>
              <p className={`text-xs mt-1 ${isDarkTheme ? 'text-slate-500' : 'text-gray-500'}`}>days in a row</p>
            </div>
            <div className={`p-4 rounded-lg ${isDarkTheme ? 'bg-slate-800/60 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
              <div className="text-3xl font-black text-yellow-400 mb-1">🎯</div>
              <p className={`text-xs font-bold opacity-75 ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>Goals Met</p>
              <p className={`text-2xl font-black ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>{achievements.streaks.goal}</p>
              <p className={`text-xs mt-1 ${isDarkTheme ? 'text-slate-500' : 'text-gray-500'}`}>month(s)</p>
            </div>
          </div>

          {/* Badges */}
          <div>
            <h3 className={`text-lg font-bold mb-3 ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>Badges</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {achievements.allBadges.map((badge, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg text-center transition-all ${
                    badge.unlocked
                      ? isDarkTheme
                        ? 'bg-gradient-to-br from-slate-700/80 to-slate-800/40 border-2 border-cyan-400/60 shadow-lg shadow-cyan-400/20'
                        : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-400 shadow-md shadow-blue-200'
                      : isDarkTheme
                      ? 'bg-slate-800/30 border-2 border-slate-700/50 opacity-50'
                      : 'bg-gray-50 border-2 border-gray-300 opacity-50'
                  }`}
                  title={badge.condition}
                >
                  <div className="text-3xl mb-1 opacity-100">{badge.icon}</div>
                  <p className={`text-xs font-bold leading-tight ${
                    badge.unlocked
                      ? isDarkTheme ? 'text-cyan-300' : 'text-blue-600'
                      : isDarkTheme ? 'text-slate-500' : 'text-gray-500'
                  }`}>
                    {badge.label}
                  </p>
                  <p className={`text-xs mt-1 leading-tight ${
                    badge.unlocked
                      ? isDarkTheme ? 'text-cyan-400/70' : 'text-blue-500/70'
                      : isDarkTheme ? 'text-slate-600' : 'text-gray-400'
                  }`}>
                    {badge.condition}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
