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
        ? 'bg-gradient-to-br from-purple-900/30 to-blue-900/20 border-purple-500/30'
        : themeConfig.name === 'simple-light'
        ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200'
        : 'bg-black border-white'
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
          <div className={`h-2 rounded-full overflow-hidden ${themeConfig.name === 'simple-light' ? 'bg-purple-200' : 'bg-purple-900/50'}`}>
            <div 
              className={`h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300`}
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
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-50'
            : themeConfig.name === 'simple-light'
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-50'
            : 'bg-white text-black border border-white hover:bg-gray-100 disabled:opacity-50'
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
        <div className="mt-4 pt-3 border-t border-purple-500/30">
          <div className={`text-xs font-semibold mb-2 ${themeConfig.name === 'simple-light' ? 'text-gray-600' : 'text-gray-400'}`}>
            Unlocked Rewards
          </div>
          <div className="grid grid-cols-3 gap-2">
            {pointsData.unlocked_rewards.slice(0, 3).map((reward: any) => (
              <div key={reward.name} className={`p-2 rounded text-center ${
                themeConfig.name === 'simple-light'
                  ? 'bg-purple-100'
                  : 'bg-purple-900/30'
              }`}>
                <div className="text-lg mb-0.5">{reward.emoji}</div>
                <div className={`text-xs font-bold ${themeConfig.name === 'simple-light' ? 'text-purple-900' : 'text-purple-300'}`}>
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
