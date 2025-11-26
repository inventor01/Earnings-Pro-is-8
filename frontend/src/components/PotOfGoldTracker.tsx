import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../lib/themeContext';
import { api } from '../lib/api';

export function PotOfGoldTracker() {
  const { config: themeConfig } = useTheme();

  const { data: monthlyGoal } = useQuery({
    queryKey: ['goal', 'THIS_MONTH'],
    queryFn: () => api.getGoal('THIS_MONTH'),
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['rollup', 'THIS_MONTH'],
    queryFn: async () => {
      const res = await fetch('/api/rollup?timeframe=THIS_MONTH');
      return res.json();
    },
  });

  if (!monthlyGoal || !monthlyData) return null;

  const currentProfit = parseFloat(monthlyData?.profit) || 0;
  const goalAmount = parseFloat(monthlyGoal?.target_profit) || 0;
  
  // Don't show if no goal is set or goal is 0
  if (goalAmount === 0) return null;
  
  const progressPercent = Math.min((currentProfit / goalAmount) * 100, 100);
  const isGoalReached = currentProfit >= goalAmount;

  return (
    <div className={`rounded-2xl p-5 md:p-6 border-2 transition-all ${
      themeConfig.name === 'dark-neon'
        ? 'bg-gradient-to-br from-yellow-900/30 to-orange-900/20 border-yellow-500/30'
        : themeConfig.name === 'simple-light'
        ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200'
        : 'bg-black border-yellow-400'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className={`font-bold text-lg mb-1 ${
            themeConfig.name === 'simple-light' ? 'text-yellow-900' : 'text-yellow-400'
          }`}>
            🍀 Monthly Pot of Gold
          </h3>
          <p className={`text-sm ${
            themeConfig.name === 'simple-light' ? 'text-yellow-700' : 'text-yellow-300'
          }`}>
            {Math.round(progressPercent)}% to your monthly treasure
          </p>
        </div>
        <div className={`text-3xl font-bold ${
          themeConfig.name === 'simple-light' ? 'text-yellow-600' : 'text-yellow-400'
        }`}>
          🪙
        </div>
      </div>

      {/* Rainbow bridge effect */}
      <div className="mb-4 h-12 relative">
        <div className="absolute inset-0 flex items-end justify-between gap-1 px-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-all duration-300 ${
                i / 5 <= progressPercent / 100
                  ? i === 0 ? 'bg-red-400' : i === 1 ? 'bg-yellow-400' : i === 2 ? 'bg-green-400' : i === 3 ? 'bg-blue-400' : 'bg-purple-400'
                  : themeConfig.name === 'simple-light' ? 'bg-gray-200' : 'bg-gray-700'
              }`}
              style={{
                height: `${20 + i * 6}px`,
                opacity: i / 5 <= progressPercent / 100 ? 1 : 0.3,
              }}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className={`h-3 rounded-full overflow-hidden mb-3 ${
        themeConfig.name === 'dark-neon'
          ? 'bg-yellow-900/50'
          : themeConfig.name === 'simple-light'
          ? 'bg-yellow-200'
          : 'bg-gray-700'
      }`}>
        <div
          className="h-full bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 transition-all duration-500 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Pot and coins */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${
            themeConfig.name === 'simple-light' ? 'text-yellow-900' : 'text-yellow-400'
          }`}>
            ${currentProfit.toFixed(0)}
          </span>
          <span className={`text-sm ${
            themeConfig.name === 'simple-light' ? 'text-yellow-600' : 'text-yellow-300'
          }`}>
            of ${goalAmount.toFixed(0)}
          </span>
        </div>
        {isGoalReached && (
          <div className="text-2xl animate-bounce">🏆</div>
        )}
      </div>

      {/* Celebration message */}
      {isGoalReached && (
        <div className={`mt-3 p-2 rounded-lg text-center text-sm font-bold ${
          themeConfig.name === 'dark-neon'
            ? 'bg-yellow-900/30 text-yellow-300'
            : themeConfig.name === 'simple-light'
            ? 'bg-yellow-200 text-yellow-900'
            : 'bg-yellow-900/30 border border-yellow-400 text-yellow-300'
        }`}>
          ✨ You found your pot of gold! ✨
        </div>
      )}
    </div>
  );
}
