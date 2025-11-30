import { useState } from 'react';
import { useTheme } from '../lib/themeContext';
import { useQuery } from '@tanstack/react-query';
import { api, TimeframeType } from '../lib/api';

interface TimeframeGoalsProps {
  rollup: any;
}

const TIMEFRAMES: { type: TimeframeType; label: string; color: string }[] = [
  { type: 'TODAY', label: 'Today', color: 'from-blue-500 to-blue-600' },
  { type: 'THIS_WEEK', label: 'This Week', color: 'from-purple-500 to-purple-600' },
  { type: 'THIS_MONTH', label: 'This Month', color: 'from-orange-500 to-orange-600' },
];

export function TimeframeGoals({ rollup }: TimeframeGoalsProps) {
  const { config } = useTheme();
  const isDarkTheme = config.name !== 'ninja-green';
  const [editingTimeframe, setEditingTimeframe] = useState<TimeframeType | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const { data: goals = {} } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const result: Record<TimeframeType, any> = {};
      for (const tf of TIMEFRAMES) {
        try {
          const goal = await api.getGoal(tf.type);
          result[tf.type] = goal;
        } catch {
          result[tf.type] = null;
        }
      }
      return result;
    },
  });

  const getProgress = (timeframe: TimeframeType): number => {
    const goal = goals[timeframe];
    if (!goal || !rollup) return 0;

    let current = 0;
    if (timeframe === 'TODAY') current = rollup.revenue || 0;
    else if (timeframe === 'THIS_WEEK') current = rollup.revenue || 0;
    else if (timeframe === 'THIS_MONTH') current = rollup.revenue || 0;

    return Math.min((current / goal.target_profit) * 100, 100);
  };

  const handleSaveGoal = async (timeframe: TimeframeType, amount: string) => {
    try {
      const numAmount = parseFloat(amount);
      if (numAmount > 0) {
        await api.createGoal(timeframe, numAmount);
        setEditingTimeframe(null);
        setEditingValue('');
      }
    } catch (error) {
      console.error('Failed to save goal:', error);
    }
  };

  return (
    <div
      className={`w-full px-3 md:px-6 py-4 md:py-6 ${
        isDarkTheme
          ? 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700'
          : 'bg-gradient-to-r from-slate-50 via-blue-50 to-slate-50 border-b border-slate-200'
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <h2
          className={`text-lg md:text-xl font-bold mb-4 ${
            isDarkTheme ? 'text-slate-100' : 'text-slate-900'
          }`}
        >
          Goals & Progress
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIMEFRAMES.map((tf) => {
            const goal = goals[tf.type];
            const progress = goal ? getProgress(tf.type) : 0;
            const isEditing = editingTimeframe === tf.type;

            return (
              <div
                key={tf.type}
                className={`p-4 rounded-lg ${
                  isDarkTheme
                    ? 'bg-slate-800 border border-slate-700'
                    : 'bg-white border border-slate-200'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span
                    className={`font-semibold text-sm md:text-base ${
                      isDarkTheme ? 'text-slate-200' : 'text-slate-700'
                    }`}
                  >
                    {tf.label}
                  </span>
                  {goal && (
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${
                        progress >= 100
                          ? isDarkTheme
                            ? 'bg-green-900/50 text-green-300'
                            : 'bg-green-100 text-green-700'
                          : isDarkTheme
                          ? 'bg-slate-700 text-slate-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {Math.round(progress)}%
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <div className="flex gap-2 mb-2">
                    <input
                      type="number"
                      step="0.01"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      placeholder="Goal amount"
                      className={`flex-1 px-2 py-1 rounded border-2 text-sm font-medium ${
                        isDarkTheme
                          ? 'bg-slate-700 border-blue-500 text-blue-300 placeholder-slate-500'
                          : 'bg-white border-blue-400 text-slate-900 placeholder-slate-400'
                      }`}
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        handleSaveGoal(tf.type, editingValue);
                      }}
                      className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition-colors"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => {
                        setEditingTimeframe(null);
                        setEditingValue('');
                      }}
                      className="px-2 py-1 bg-slate-500 hover:bg-slate-600 text-white text-xs font-bold rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mb-2">
                    {goal ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <div
                            className={`text-lg md:text-2xl font-black ${
                              isDarkTheme ? 'text-blue-400' : 'text-blue-600'
                            }`}
                          >
                            ${goal.target_profit.toFixed(2)}
                          </div>
                          <div
                            className={`text-xs md:text-sm ${
                              isDarkTheme ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            Goal
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setEditingTimeframe(tf.type);
                            setEditingValue(goal.target_profit.toString());
                          }}
                          className={`text-xs font-bold transition-colors ${
                            isDarkTheme
                              ? 'text-blue-400 hover:text-blue-300'
                              : 'text-blue-600 hover:text-blue-700'
                          }`}
                        >
                          Edit
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingTimeframe(tf.type);
                          setEditingValue('');
                        }}
                        className={`w-full py-2 rounded font-semibold text-sm transition-colors ${
                          isDarkTheme
                            ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        + Set Goal
                      </button>
                    )}
                  </div>
                )}

                {goal && (
                  <>
                    <div
                      className={`w-full h-2 md:h-3 rounded-full overflow-hidden ${
                        isDarkTheme ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    >
                      <div
                        className={`h-full bg-gradient-to-r ${tf.color} transition-all duration-500`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <div
                      className={`text-xs mt-2 ${
                        isDarkTheme ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      Progress: ${rollup?.revenue?.toFixed(2) || '0.00'}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
