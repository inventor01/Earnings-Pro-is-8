import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../lib/themeContext';
import { api } from '../lib/api';

export function PotOfGoldTracker() {
  const { config: themeConfig } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [tempGoal, setTempGoal] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [floatingCoins, setFloatingCoins] = useState<number[]>([]);
  const [isHidden, setIsHidden] = useState(false);

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

  const currentProfit = Math.max(0, parseFloat(monthlyData?.profit as string) || 0);
  const goalAmount = parseFloat(monthlyGoal?.target_profit as string) || 0;
  
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

  const triggerCoins = () => {
    const newCoins = Array.from({ length: 5 }, (_, i) => Date.now() + i * 100);
    setFloatingCoins(prev => [...prev, ...newCoins]);
    setTimeout(() => {
      setFloatingCoins([]);
    }, 2000);
  };

  if (isHidden) {
    return (
      <div className={`rounded-2xl p-4 border-2 transition-all ${
        themeConfig.name === 'dark-neon'
          ? 'bg-gradient-to-br from-purple-900/60 via-slate-900/50 to-blue-900/40 border-cyan-400/60'
          : themeConfig.name === 'simple-light'
          ? 'bg-gradient-to-br from-blue-100 via-purple-50 to-yellow-100 border-purple-300'
          : 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border-cyan-500/60'
      }`}>
        <button
          onClick={() => setIsHidden(false)}
          className={`w-full py-2 rounded-xl font-bold transition-all ${
            themeConfig.name === 'dark-neon'
              ? 'bg-cyan-500/30 hover:bg-cyan-500/50 text-cyan-200 border border-cyan-400/50'
              : themeConfig.name === 'simple-light'
              ? 'bg-purple-200 hover:bg-purple-300 text-purple-900'
              : 'bg-cyan-500/30 hover:bg-cyan-500/50 text-cyan-300 border border-cyan-400/30'
          }`}
        >
          Show Monthly Goal
        </button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={`rounded-2xl p-5 md:p-6 border-2 transition-all ${
        themeConfig.name === 'dark-neon'
          ? 'bg-gradient-to-br from-yellow-900/40 to-orange-900/30 border-yellow-500/50 backdrop-blur-sm'
          : themeConfig.name === 'simple-light'
          ? 'bg-gradient-to-br from-yellow-100 to-orange-100 border-yellow-300'
          : 'bg-black/60 border-yellow-500 backdrop-blur-sm'
      }`}>
        <div className="space-y-3">
          <label className={`block text-sm font-bold ${
            themeConfig.name === 'simple-light' ? 'text-yellow-900' : 'text-yellow-300'
          }`}>
            Monthly Pot of Gold Goal
          </label>
          <div className={`flex gap-2 p-3 rounded-xl border-2 transition-all ${
            themeConfig.name === 'dark-neon'
              ? 'bg-yellow-900/30 border-yellow-400/60 focus-within:border-yellow-400'
              : themeConfig.name === 'simple-light'
              ? 'bg-white border-yellow-300 focus-within:border-yellow-500'
              : 'bg-gray-900 border-yellow-500/60 focus-within:border-yellow-400'
          }`}>
            <span className={`font-bold text-lg ${themeConfig.name === 'simple-light' ? 'text-yellow-900' : 'text-yellow-400'}`}>$</span>
            <input
              type="number"
              value={tempGoal}
              onChange={(e) => setTempGoal(e.target.value)}
              placeholder="Enter goal amount"
              className={`flex-1 bg-transparent outline-none font-bold text-lg ${
                themeConfig.name === 'simple-light' ? 'text-yellow-900' : 'text-yellow-300'
              }`}
              autoFocus
            />
          </div>
          {error && (
            <p className={`text-sm font-medium animate-pulse ${
              themeConfig.name === 'simple-light' ? 'text-red-600' : 'text-red-400'
            }`}>
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                themeConfig.name === 'dark-neon'
                  ? 'bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-300 hover:to-orange-300 text-black disabled:opacity-50 shadow-lg hover:shadow-yellow-400/50'
                  : themeConfig.name === 'simple-light'
                  ? 'bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-white disabled:opacity-50'
                  : 'bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-300 hover:to-orange-300 text-black disabled:opacity-50 shadow-lg'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Goal'}
            </button>
            <button
              onClick={handleCancel}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                themeConfig.name === 'dark-neon'
                  ? 'bg-gray-700/60 hover:bg-gray-600/80 text-gray-100'
                  : themeConfig.name === 'simple-light'
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  : 'bg-gray-700/60 hover:bg-gray-600/80 text-gray-100'
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
    <div 
      className={`rounded-3xl p-8 md:p-12 border-2 transition-all group relative overflow-hidden min-h-96 md:min-h-[28rem] ${
        themeConfig.name === 'dark-neon'
          ? 'bg-gradient-to-br from-purple-900/60 via-slate-900/50 to-blue-900/40 border-cyan-400/60 hover:border-cyan-300/80 hover:from-purple-900/80 hover:via-slate-900/70 hover:to-blue-900/60 shadow-2xl hover:shadow-cyan-400/40'
          : themeConfig.name === 'simple-light'
          ? 'bg-gradient-to-br from-blue-100 via-purple-50 to-yellow-100 border-purple-300 hover:border-purple-400'
          : 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border-cyan-500/60 hover:border-cyan-300'
      }`}
      style={{
        animation: themeConfig.name === 'dark-neon' ? 'pot-glow 3s ease-in-out infinite' : 'none'
      }}
    >
      {/* Starfield background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={`star-${i}`}
            className="absolute bg-white rounded-full opacity-70"
            style={{
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animation: `twinkle ${Math.random() * 3 + 2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      {/* Floating coins animation */}
      <div className="absolute inset-0 pointer-events-none">
        {floatingCoins.map((coinId, idx) => (
          <div
            key={coinId}
            className="absolute text-3xl"
            style={{
              left: `${20 + (idx % 5) * 15}%`,
              bottom: '10%',
              animation: `floating-coin 2s ease-out forwards`,
              animationDelay: `${idx * 0.15}s`,
            }}
          >
            🪙
          </div>
        ))}
      </div>

      {/* Header section */}
      <div className="relative z-10 flex items-start justify-between mb-10 gap-6">
        <div className="cursor-pointer" onClick={handleEditClick}>
          <h3 className={`font-black text-2xl md:text-3xl mb-3 ${
            themeConfig.name === 'simple-light' ? 'text-purple-900' : 'text-cyan-300'
          }`}
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent'
          }}>
            Monthly Profit Goal
          </h3>
          <p className={`text-sm md:text-base font-semibold ${
            themeConfig.name === 'simple-light' ? 'text-purple-700' : 'text-cyan-400'
          }`}
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent'
          }}>
            {Math.round(progressPercent)}% to your monthly treasure
          </p>
        </div>
        <div 
          onClick={triggerCoins}
          className="text-7xl md:text-8xl cursor-pointer hover:scale-125 transition-transform"
          style={{
            animation: 'pulse-gold 1.5s ease-in-out infinite',
            filter: 'drop-shadow(0 0 10px rgba(34, 211, 238, 0.8))'
          }}
        >
          🪙
        </div>
      </div>

      {/* Cosmic decorations */}
      <div className="relative z-10 flex justify-between items-center mb-8 opacity-80">
      </div>

      {/* Rainbow bridge effect */}
      <div className="relative z-10 mb-8 h-20 group/rainbow">
        <div className="absolute inset-0 flex items-end justify-between gap-1.5 px-2">
          {[...Array(5)].map((_, i) => {
            const barFillPercent = (i + 1) / 5;
            const isFilled = progressPercent / 100 >= barFillPercent;
            const colors = ['bg-red-400', 'bg-yellow-400', 'bg-green-400', 'bg-blue-400', 'bg-purple-400'];
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-500 transform group-hover/rainbow:scale-y-110 ${
                  isFilled
                    ? colors[i]
                    : themeConfig.name === 'simple-light' ? 'bg-gray-300' : 'bg-gray-700'
                }`}
                style={{
                  height: `${24 + i * 8}px`,
                  opacity: isFilled ? 1 : 0.2,
                  boxShadow: isFilled ? `0 0 15px ${colors[i].split('-')[1] === 'red' ? 'rgb(248, 113, 113)' : colors[i].split('-')[1] === 'yellow' ? 'rgb(250, 204, 21)' : colors[i].split('-')[1] === 'green' ? 'rgb(74, 222, 128)' : colors[i].split('-')[1] === 'blue' ? 'rgb(96, 165, 250)' : 'rgb(192, 132, 250)'}` : 'none'
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Progress bar with glow */}
      <div className={`relative z-10 h-6 rounded-full overflow-hidden mb-8 border-2 border-opacity-50 ${
        themeConfig.name === 'dark-neon'
          ? 'bg-slate-800/60 border-cyan-400/50'
          : themeConfig.name === 'simple-light'
          ? 'bg-blue-200 border-purple-300'
          : 'bg-slate-800 border-cyan-500/30'
      }`}>
        <div
          className={`h-full transition-all duration-700 rounded-full ${
            themeConfig.name === 'dark-neon'
              ? 'bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 shadow-lg shadow-yellow-400/60'
              : 'bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500'
          }`}
          style={{ 
            width: `${progressPercent}%`,
            boxShadow: themeConfig.name === 'dark-neon' ? `0 0 15px rgba(250, 204, 21, 0.5)` : 'none'
          }}
        />
      </div>

      {/* Stats section */}
      <div className="relative z-10 flex items-center justify-between mb-6 gap-4">
        <div className="flex items-baseline gap-3">
          <span className={`text-4xl font-black ${
            themeConfig.name === 'simple-light' ? 'text-yellow-900' : 'text-yellow-300'
          }`}
          style={{
            animation: isGoalReached ? 'pulse-gold 0.6s ease-out' : 'none',
            backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent'
          }}>
            ${currentProfit.toFixed(0)}
          </span>
          <span className={`text-base font-bold ${
            themeConfig.name === 'simple-light' ? 'text-yellow-700' : 'text-yellow-400'
          }`}
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent'
          }}>
            / ${goalAmount.toFixed(0)}
          </span>
        </div>
        <div className="flex items-center gap-2">
        </div>
      </div>

      {/* Celebration message */}
      {isGoalReached && (
        <div className={`relative z-10 p-4 rounded-2xl text-center text-base font-bold animate-pulse ${
          themeConfig.name === 'dark-neon'
            ? 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 text-cyan-200 border-2 border-cyan-400/50 shadow-lg shadow-cyan-400/30'
            : themeConfig.name === 'simple-light'
            ? 'bg-purple-300 text-purple-900'
            : 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 text-cyan-300 border-2 border-cyan-400/50'
        }`}
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          color: 'transparent'
        }}>
          You found your pot of gold!
        </div>
      )}

      {/* Hint text */}
      <div className={`relative z-10 text-sm text-center mt-6 opacity-70 transition-all group-hover:opacity-100 ${
        themeConfig.name === 'simple-light' ? 'text-purple-700' : 'text-cyan-300'
      }`}
      style={{
        backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        color: 'transparent'
      }}>
        Click the coin to celebrate • Click to edit your goal
      </div>

      {/* Hide button */}
      <div className="relative z-10 mt-8 pt-6 border-t border-opacity-30" style={{
        borderColor: themeConfig.name === 'simple-light' ? 'rgb(192, 132, 250)' : 'rgba(34, 211, 238, 0.2)'
      }}>
        <button
          onClick={() => setIsHidden(true)}
          className={`px-3 py-1 text-xs rounded font-semibold transition-all duration-200 ${
            themeConfig.name === 'dark-neon'
              ? 'bg-gradient-to-r from-slate-700/60 to-slate-600/60 hover:from-slate-600/80 hover:to-slate-500/80 border border-slate-500/40 hover:border-slate-400/60'
              : themeConfig.name === 'simple-light'
              ? 'bg-gradient-to-r from-purple-200 to-purple-200 hover:from-purple-300 hover:to-purple-300'
              : 'bg-gradient-to-r from-slate-700/60 to-slate-600/60 hover:from-slate-600/80 hover:to-slate-500/80 border border-slate-500/40 hover:border-slate-400/60'
          }`}
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent'
          }}
        >
          Hide
        </button>
      </div>
    </div>
  );
}
