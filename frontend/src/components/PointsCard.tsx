import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../lib/themeContext';
import { useState } from 'react';

export function PointsCard() {
  const { config: themeConfig } = useTheme();
  const queryClient = useQueryClient();
  const [checkInMessage, setCheckInMessage] = useState('');

  const { data: pointsData } = useQuery({
    queryKey: ['userPoints'],
    queryFn: async () => {
      const res = await fetch('/api/points/user');
      return res.json();
    },
    refetchInterval: 60000,
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/points/daily-check-in', { method: 'POST' });
      return res.json();
    },
    onSuccess: (data) => {
      setCheckInMessage(data.message);
      queryClient.invalidateQueries({ queryKey: ['userPoints'] });
      setTimeout(() => setCheckInMessage(''), 3000);
    },
  });

  if (!pointsData) return null;

  const progressPercent = Math.min(
    (pointsData.total_points / (pointsData.next_reward_points || 250)) * 100,
    100
  );

  return (
    <div className={`rounded-xl p-4 border-2 transition-all ${
      themeConfig.name === 'dark-neon'
        ? 'bg-gradient-to-br from-orange-900/30 to-yellow-900/20 border-orange-500/30'
        : themeConfig.name === 'simple-light'
        ? 'bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200'
        : 'bg-black border-orange-400'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⭐</span>
          <div>
            <div className={`text-2xl font-bold ${themeConfig.name === 'simple-light' ? 'text-purple-900' : 'text-purple-400'}`}>
              {pointsData.total_points}
            </div>
            <div className={`text-xs ${themeConfig.name === 'simple-light' ? 'text-purple-600' : 'text-purple-300'}`}>
              Total Points
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${themeConfig.name === 'simple-light' ? 'text-red-600' : 'text-red-400'}`}>
            🔥 {pointsData.daily_streak}
          </div>
          <div className={`text-xs ${themeConfig.name === 'simple-light' ? 'text-red-600' : 'text-red-300'}`}>
            Day Streak
          </div>
        </div>
      </div>

      {pointsData.next_reward_points && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className={`text-xs font-semibold ${themeConfig.name === 'simple-light' ? 'text-gray-600' : 'text-gray-400'}`}>
              Next Reward
            </span>
            <span className={`text-xs font-bold ${themeConfig.name === 'simple-light' ? 'text-purple-700' : 'text-purple-300'}`}>
              {pointsData.total_points}/{pointsData.next_reward_points}
            </span>
          </div>
          <div className={`h-2 rounded-full overflow-hidden ${
            themeConfig.name === 'dark-neon'
              ? 'bg-orange-900/50'
              : themeConfig.name === 'simple-light'
              ? 'bg-orange-200'
              : 'bg-gray-700'
          }`}>
            <div 
              className={`h-full transition-all duration-300 ${
                themeConfig.name === 'dark-neon'
                  ? 'bg-gradient-to-r from-orange-500 to-yellow-500'
                  : themeConfig.name === 'simple-light'
                  ? 'bg-gradient-to-r from-orange-500 to-yellow-500'
                  : 'bg-gradient-to-r from-orange-400 to-yellow-300'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={() => checkInMutation.mutate()}
        disabled={checkInMutation.isPending}
        className={`w-full py-2 px-3 rounded-lg font-bold text-sm transition-all ${
          themeConfig.name === 'dark-neon'
            ? 'bg-gradient-to-r from-orange-600 to-yellow-600 text-white hover:from-orange-500 hover:to-yellow-500 disabled:opacity-50'
            : themeConfig.name === 'simple-light'
            ? 'bg-gradient-to-r from-orange-600 to-yellow-600 text-white hover:from-orange-700 hover:to-yellow-700 disabled:opacity-50'
            : 'bg-gradient-to-r from-orange-400 to-yellow-300 text-black border border-orange-400 hover:from-orange-300 hover:to-yellow-200 disabled:opacity-50'
        }`}
      >
        {checkInMutation.isPending ? 'Checking in...' : 'Daily Check-in'}
      </button>

      {checkInMessage && (
        <div className={`mt-2 p-2 rounded text-xs text-center ${
          themeConfig.name === 'simple-light'
            ? 'bg-green-100 text-green-700'
            : 'bg-green-900/30 text-green-400'
        }`}>
          {checkInMessage}
        </div>
      )}

      {pointsData.unlocked_rewards.length > 0 && (
        <div className={`mt-4 pt-3 border-t ${
          themeConfig.name === 'dark-neon'
            ? 'border-orange-500/30'
            : themeConfig.name === 'simple-light'
            ? 'border-orange-200'
            : 'border-orange-400'
        }`}>
          <div className={`text-xs font-semibold mb-2 ${themeConfig.name === 'simple-light' ? 'text-gray-600' : 'text-gray-400'}`}>
            Unlocked Rewards
          </div>
          <div className="grid grid-cols-3 gap-2">
            {pointsData.unlocked_rewards.slice(0, 3).map((reward: any) => (
              <div key={reward.name} className={`p-2 rounded text-center ${
                themeConfig.name === 'dark-neon'
                  ? 'bg-orange-900/30'
                  : themeConfig.name === 'simple-light'
                  ? 'bg-orange-100'
                  : 'bg-orange-900/30 border border-orange-400'
              }`}>
                <div className="text-lg mb-0.5">{reward.emoji}</div>
                <div className={`text-xs font-bold ${
                  themeConfig.name === 'dark-neon'
                    ? 'text-orange-300'
                    : themeConfig.name === 'simple-light'
                    ? 'text-orange-900'
                    : 'text-orange-300'
                }`}>
                  {reward.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
