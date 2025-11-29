import { useState, useMemo } from 'react';
import { useTheme } from '../lib/themeContext';

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
    type Badge = { icon: string; label: string; color: string };
    const badges: Badge[] = [];
    if (greenStreak >= 7) badges.push({ icon: 'fire', label: `${greenStreak}-Day Green Streak!`, color: 'text-red-500' });
    if (profitableDays >= 10) badges.push({ icon: 'heart', label: `${profitableDays} Profitable Days`, color: 'text-green-500' });
    if (goalStreak > 0) badges.push({ icon: 'target', label: 'Goal Crushed This Month!', color: 'text-yellow-500' });
    if (profitableDays >= 20) badges.push({ icon: 'star', label: 'Consistent Earner', color: 'text-yellow-400' });
    if (greenStreak >= 1) badges.push({ icon: 'check', label: 'Started Strong Today', color: 'text-green-400' });

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
          <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
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
              <svg className="w-7 h-7 text-red-500 mx-auto mb-1" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 2.08 13.5.67zM12 19.35c-3.13 0-5.68-2.55-5.68-5.68 0-3.14 2.55-5.68 5.68-5.68s5.68 2.55 5.68 5.68c0 3.13-2.55 5.68-5.68 5.68z"/></svg>
              <p className={`text-xs font-bold opacity-75 ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>Green Streak</p>
              <p className={`text-lg font-black ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>{achievements.streaks.green} days</p>
            </div>
            <div className={`p-3 rounded-lg ${isDarkTheme ? 'bg-slate-700/50' : 'bg-blue-50'}`}>
              <svg className="w-7 h-7 text-yellow-400 mx-auto mb-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
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
                  {badge.icon === 'fire' && <svg className={`w-6 h-6 ${badge.color} mx-auto mb-1`} fill="currentColor" viewBox="0 0 24 24"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 2.08 13.5.67zM12 19.35c-3.13 0-5.68-2.55-5.68-5.68 0-3.14 2.55-5.68 5.68-5.68s5.68 2.55 5.68 5.68c0 3.13-2.55 5.68-5.68 5.68z"/></svg>}
                  {badge.icon === 'heart' && <svg className={`w-6 h-6 ${badge.color} mx-auto mb-1`} fill="currentColor" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>}
                  {badge.icon === 'target' && <svg className={`w-6 h-6 ${badge.color} mx-auto mb-1`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>}
                  {badge.icon === 'star' && <svg className={`w-6 h-6 ${badge.color} mx-auto mb-1 mr-3`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                  {badge.icon === 'check' && <svg className={`w-6 h-6 ${badge.color} mx-auto mb-1`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>}
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
