import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../lib/themeContext';
import { api } from '../lib/api';

export function PotOfGoldTracker() {
  const { config: themeConfig } = useTheme();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [tempGoal, setTempGoal] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { data: monthlyGoal, refetch: refetchGoal } = useQuery({
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

  // Ensure negative values are treated as 0
  const currentProfit = Math.max(0, parseFloat(monthlyData?.profit) || 0);
  const goalAmount = parseFloat(monthlyGoal?.target_profit) || 0;
  
  // Don't show if no goal is set or goal is 0
  if (goalAmount === 0) return null;
  
  const progressPercent = Math.min(Math.max(0, (currentProfit / goalAmount) * 100), 100);
  const isGoalReached = currentProfit >= goalAmount;

  const handleEditClick = () => {
    setTempGoal(goalAmount.toString());
    setIsEditing(true);
    setError('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      if (!tempGoal || parseFloat(tempGoal) <= 0) {
        setError('Please enter a valid amount greater than 0');
        setIsSaving(false);
        return;
      }
      await api.createGoal('THIS_MONTH', parseFloat(tempGoal));
      await refetchGoal();
      setIsEditing(false);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to save goal';
      setError(errorMsg);
      console.error('Failed to save goal:', e);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
  };

  if (isEditing) {
    return (
      <div className={`rounded-2xl p-5 md:p-6 border-2 ${
        themeConfig.name === 'dark-neon'
          ? 'bg-gradient-to-br from-yellow-900/30 to-orange-900/20 border-yellow-500/30'
          : themeConfig.name === 'simple-light'
          ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200'
          : 'bg-black border-yellow-400'
      }`}>
        <div className="space-y-3">
          <label className={`block text-sm font-medium ${
            themeConfig.name === 'simple-light' ? 'text-yellow-900' : 'text-yellow-400'
          }`}>
            Monthly Pot of Gold Goal
          </label>
          <div className={`flex gap-2 p-2 rounded-lg border ${
            themeConfig.name === 'dark-neon'
              ? 'bg-yellow-900/20 border-yellow-500/30'
              : themeConfig.name === 'simple-light'
              ? 'bg-white border-yellow-200'
              : 'bg-gray-900 border-yellow-400'
          }`}>
            <span className={themeConfig.name === 'simple-light' ? 'text-yellow-900' : 'text-yellow-400'}>$</span>
            <input
              type="number"
              value={tempGoal}
              onChange={(e) => setTempGoal(e.target.value)}
              placeholder="Enter goal amount"
              className={`flex-1 bg-transparent outline-none font-medium ${
                themeConfig.name === 'simple-light' ? 'text-yellow-900' : 'text-yellow-400'
              }`}
              autoFocus
            />
          </div>
          {error && (
            <p className={`text-sm font-medium ${
              themeConfig.name === 'simple-light' ? 'text-red-600' : 'text-red-400'
            }`}>
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                themeConfig.name === 'dark-neon'
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-black disabled:opacity-50'
                  : themeConfig.name === 'simple-light'
                  ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900 disabled:opacity-50'
                  : 'bg-yellow-400 hover:bg-yellow-300 text-black disabled:opacity-50'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                themeConfig.name === 'dark-neon'
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-100'
                  : themeConfig.name === 'simple-light'
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-100'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-5 md:p-6 border-2 transition-all cursor-pointer hover:border-yellow-400 ${
      themeConfig.name === 'dark-neon'
        ? 'bg-gradient-to-br from-yellow-900/30 to-orange-900/20 border-yellow-500/30'
        : themeConfig.name === 'simple-light'
        ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200'
        : 'bg-black border-yellow-400'
    }`}
    onClick={handleEditClick}>
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
          {[...Array(5)].map((_, i) => {
            const barFillPercent = (i + 1) / 5;
            const isFilled = progressPercent / 100 >= barFillPercent;
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-300 ${
                  isFilled
                    ? i === 0 ? 'bg-red-400' : i === 1 ? 'bg-yellow-400' : i === 2 ? 'bg-green-400' : i === 3 ? 'bg-blue-400' : 'bg-purple-400'
                    : themeConfig.name === 'simple-light' ? 'bg-gray-200' : 'bg-gray-700'
                }`}
                style={{
                  height: `${20 + i * 6}px`,
                  opacity: isFilled ? 1 : 0.3,
                }}
              />
            );
          })}
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
