import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../lib/themeContext';
import { useAuth } from '../lib/authContext';
import { api } from '../lib/api';

export function PotOfGoldTracker() {
  const { config: themeConfig } = useTheme();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [tempGoal, setTempGoal] = useState('');
  const [tempGoalName, setTempGoalName] = useState('Savings Goal');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [floatingShuriken, setFloatingShuriken] = useState<number[]>([]);
  const [isHidden, setIsHidden] = useState(false);

  const { data: monthlyGoal, refetch: refetchGoal } = useQuery({
    queryKey: ['goal', 'THIS_MONTH', user?.id],
    queryFn: () => api.getGoal('THIS_MONTH'),
    staleTime: 0,
    refetchOnMount: 'stale',
  });

  const { data: monthlyData, refetch: refetchMonthlyData } = useQuery({
    queryKey: ['rollup', 'THIS_MONTH', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/rollup?timeframe=THIS_MONTH');
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: 'stale',
  });

  const currentProfit = Math.max(0, parseFloat(String(monthlyData?.profit)) || 0);
  const goalAmount = parseFloat(String(monthlyGoal?.target_profit)) || 0;
  
  const progressPercent = goalAmount > 0 ? Math.round(Math.min(Math.max(0, (currentProfit / goalAmount) * 100), 100) * 100) / 100 : 0;
  const isGoalReached = currentProfit >= goalAmount;

  const handleEditClick = () => {
    setTempGoal(goalAmount > 0 ? goalAmount.toString() : '');
    setTempGoalName(monthlyGoal?.goal_name || 'Savings Goal');
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
      await api.createGoal('THIS_MONTH', parseFloat(tempGoal), tempGoalName || 'Savings Goal');
      await refetchGoal();
      await refetchMonthlyData();
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

  const triggerShuriken = () => {
    const newShuriken = Array.from({ length: 12 }, (_, i) => Date.now() + i * 30);
    setFloatingShuriken(prev => [...prev, ...newShuriken]);
    setTimeout(() => {
      setFloatingShuriken([]);
    }, 2800);
  };

  if (isHidden) {
    return (
      <div className={`rounded-2xl p-4 border-2 transition-all ${
        themeConfig.name === 'dark-neon'
          ? 'bg-slate-900 border-cyan-400/60'
          : themeConfig.name === 'simple-light'
          ? 'bg-white border-blue-300'
          : themeConfig.name === 'ninja-green'
          ? 'bg-white border-lime-500'
          : 'bg-slate-900 border-cyan-500/60'
      }`}>
        <button
          onClick={() => setIsHidden(false)}
          className={`w-full py-2 rounded-xl font-bold transition-all ${
            themeConfig.name === 'dark-neon'
              ? 'bg-cyan-500/30 hover:bg-cyan-500/50 text-cyan-200 border border-cyan-400/50'
              : themeConfig.name === 'simple-light'
              ? 'bg-blue-200 hover:bg-blue-300 text-blue-900'
              : themeConfig.name === 'ninja-green'
              ? 'bg-lime-500 hover:bg-lime-600 text-white border border-lime-600'
              : 'bg-cyan-500/30 hover:bg-cyan-500/50 text-cyan-300 border border-cyan-400/30'
          }`}
        >
          Show Monthly Target
        </button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={`rounded-2xl p-5 md:p-6 border-2 transition-all ${
        themeConfig.name === 'dark-neon'
          ? 'bg-yellow-900/40 border-yellow-500/50 backdrop-blur-sm'
          : themeConfig.name === 'simple-light'
          ? 'bg-yellow-100 border-yellow-300'
          : themeConfig.name === 'ninja-green'
          ? 'bg-yellow-100 border-yellow-500'
          : 'bg-black/60 border-yellow-500 backdrop-blur-sm'
      }`}>
        <div className="space-y-3">
          <label className={`block text-sm font-bold ${
            themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green' ? 'text-yellow-900' : 'text-yellow-300'
          }`}>
            Goal Name
          </label>
          <input
            type="text"
            value={tempGoalName}
            onChange={(e) => setTempGoalName(e.target.value)}
            placeholder="e.g. New Car, Emergency Fund"
            className={`w-full px-3 py-2 rounded-xl border-2 outline-none font-medium ${
              themeConfig.name === 'dark-neon'
                ? 'bg-yellow-900/30 border-yellow-400/60 focus:border-yellow-400 text-yellow-300'
                : themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green'
                ? 'bg-white border-yellow-400 focus:border-yellow-500 text-yellow-900'
                : 'bg-gray-900 border-yellow-500/60 focus:border-yellow-400 text-yellow-300'
            }`}
          />
          <label className={`block text-sm font-bold mt-3 ${
            themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green' ? 'text-yellow-900' : 'text-yellow-300'
          }`}>
            Target Amount
          </label>
          <div className={`flex gap-2 p-3 rounded-xl border-2 transition-all ${
            themeConfig.name === 'dark-neon'
              ? 'bg-yellow-900/30 border-yellow-400/60 focus-within:border-yellow-400'
              : themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green'
              ? 'bg-white border-yellow-400 focus-within:border-yellow-500'
              : 'bg-gray-900 border-yellow-500/60 focus-within:border-yellow-400'
          }`}>
            <span className={`font-bold text-lg ${themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green' ? 'text-yellow-900' : 'text-yellow-400'}`}>$</span>
            <input
              type="number"
              value={tempGoal}
              onChange={(e) => setTempGoal(e.target.value)}
              placeholder="Enter goal amount"
              className={`flex-1 bg-transparent outline-none font-bold text-lg ${
                themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green' ? 'text-yellow-900' : 'text-yellow-300'
              }`}
              autoFocus
            />
          </div>
          {error && (
            <p className={`text-sm font-medium animate-pulse ${
              themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green' ? 'text-red-600' : 'text-red-400'
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
                  ? 'bg-yellow-400 hover:bg-yellow-500 text-black disabled:opacity-50 shadow-lg'
                  : themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green'
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-50'
                  : 'bg-yellow-400 hover:bg-yellow-500 text-black disabled:opacity-50 shadow-lg'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Target'}
            </button>
            <button
              onClick={handleCancel}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                themeConfig.name === 'dark-neon'
                  ? 'bg-gray-700/60 hover:bg-gray-600/80 text-gray-100'
                  : themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green'
                  ? 'bg-gray-300 hover:bg-gray-400 text-gray-900'
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

  // Show "Set Your Goal" prompt when no goal is set
  if (goalAmount === 0) {
    return (
      <div className={`rounded-2xl p-5 md:p-6 border-2 transition-all ${
        themeConfig.name === 'dark-neon'
          ? 'bg-slate-900 border-cyan-400/60'
          : themeConfig.name === 'simple-light'
          ? 'bg-white border-blue-300'
          : themeConfig.name === 'ninja-green'
          ? 'bg-white border-lime-500'
          : 'bg-slate-900 border-cyan-500/60'
      }`}>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-5xl md:text-6xl mb-3">💵</div>
            <h3 className={`font-black text-lg md:text-xl mb-2 ${
              themeConfig.name === 'simple-light' ? 'text-blue-700' : 
              themeConfig.name === 'ninja-green' ? 'text-green-800' :
              'text-white'
            }`}>
              Launch Your Mission
            </h3>
            <p className={`text-sm ${
              themeConfig.name === 'simple-light' ? 'text-blue-600' :
              themeConfig.name === 'ninja-green' ? 'text-green-700' :
              'text-slate-300'
            }`}>
              Name your savings goal and set a target to track your progress
            </p>
          </div>
          <button
            onClick={handleEditClick}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              themeConfig.name === 'dark-neon'
                ? 'bg-yellow-400 hover:bg-yellow-500 text-black shadow-lg'
                : themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green'
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : 'bg-yellow-400 hover:bg-yellow-500 text-black shadow-lg'
            }`}
          >
            Create Savings Goal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`rounded-2xl p-4 md:p-6 border-2 transition-all group relative min-h-auto ${
        themeConfig.name === 'dark-neon'
          ? 'bg-slate-900 border-cyan-400/60 hover:border-cyan-300/80 shadow-2xl hover:shadow-cyan-400/40'
          : themeConfig.name === 'simple-light'
          ? 'bg-white border-blue-300 hover:border-blue-400'
          : themeConfig.name === 'ninja-green'
          ? 'bg-white border-lime-500 hover:border-lime-600'
          : 'bg-slate-900 border-cyan-500/60 hover:border-cyan-300'
      }`}
      style={{
        animation: themeConfig.name === 'dark-neon' ? 'pot-glow 3s ease-in-out infinite' : themeConfig.name === 'ninja-green' ? 'none' : 'none'
      }}
    >
      {/* Ninja stars/particles background */}
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

      {/* Floating shuriken animation */}
      <div className="absolute inset-0 pointer-events-none overflow-visible">
        {floatingShuriken.map((shurikenId, idx) => {
          const angle = Math.random() * Math.PI * 2;
          const velocity = 80 + Math.random() * 100;
          const randomX = Math.cos(angle) * velocity;
          const randomY = Math.sin(angle) * velocity;
          return (
            <div
              key={shurikenId}
              className="absolute text-4xl"
              style={{
                left: '50%',
                top: '50%',
                marginLeft: '-1rem',
                marginTop: '-1rem',
                animation: `burst-coin 2.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                animationDelay: `${idx * 0.02}s`,
                '--tx': `${randomX}px`,
                '--ty': `${randomY}px`,
                filter: 'drop-shadow(0 0 12px rgba(250, 204, 21, 0.8)) drop-shadow(0 0 8px rgba(34, 211, 238, 0.6))',
              } as React.CSSProperties & {
                '--tx': string;
                '--ty': string;
              }}
            >
              <div style={{
                position: 'relative',
                animation: 'spin-coin 1.2s linear forwards',
              }}>
                💵
              </div>
            </div>
          );
        })}
      </div>

      {/* Add keyframes to document if not already present */}
      <style>{`
        @keyframes burst-coin {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(var(--tx), var(--ty)) scale(0.3);
          }
        }
        @keyframes spin-coin {
          0% {
            transform: rotateY(0deg) rotateZ(0deg);
          }
          100% {
            transform: rotateY(720deg) rotateZ(180deg);
          }
        }
        @keyframes blink-red {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.8));
            opacity: 1;
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(239, 68, 68, 1));
            opacity: 0.7;
          }
        }
      `}</style>

      {/* Header section */}
      <div className="relative z-10 flex items-start justify-between mb-6 gap-4">
        <div className="cursor-pointer" onClick={handleEditClick}>
          <h3 className={`font-black text-lg md:text-xl mb-1 ${
            themeConfig.name === 'simple-light' ? 'text-blue-700' :
            themeConfig.name === 'ninja-green' ? 'text-green-800' :
            'text-white'
          }`}>
            {monthlyGoal?.goal_name || 'Savings Goal'}
          </h3>
          <p className={`text-xs md:text-sm font-semibold ${
            themeConfig.name === 'simple-light' ? 'text-blue-600' :
            themeConfig.name === 'ninja-green' ? 'text-green-700' :
            'text-slate-300'
          }`}>
            {Math.min(100, Math.round(progressPercent))}% complete
          </p>
        </div>
        <div 
          onClick={triggerShuriken}
          className="text-5xl md:text-6xl cursor-pointer hover:scale-125 transition-transform"
          style={{
            animation: 'pulse-gold 1.5s ease-in-out infinite',
            filter: 'drop-shadow(0 0 10px rgba(250, 204, 21, 0.8))'
          }}
        >
          💵
        </div>
      </div>


      {/* Progress bar with glow */}
      <div className={`relative z-10 h-4 rounded-full overflow-hidden mb-4 border-2 border-opacity-50 ${
        themeConfig.name === 'dark-neon'
          ? 'bg-slate-800/60 border-cyan-400/50'
          : themeConfig.name === 'simple-light'
          ? 'bg-blue-200 border-blue-300'
          : themeConfig.name === 'ninja-green'
          ? 'bg-lime-100 border-lime-400'
          : 'bg-slate-800 border-cyan-500/30'
      }`}>
        <div
          className={`h-full transition-all duration-700 rounded-full ${
            themeConfig.name === 'dark-neon'
              ? 'bg-yellow-400 shadow-lg shadow-yellow-400/60'
              : themeConfig.name === 'simple-light'
              ? 'bg-blue-500'
              : themeConfig.name === 'ninja-green'
              ? 'bg-lime-500'
              : 'bg-yellow-400'
          }`}
          style={{ 
            width: `${progressPercent}%`,
            boxShadow: themeConfig.name === 'dark-neon' ? `0 0 15px rgba(250, 204, 21, 0.5)` : 'none'
          }}
        />
      </div>

      {/* Stats section */}
      <div className="relative z-10 flex items-center justify-between mb-4 gap-2">
        <div className="flex items-baseline gap-3">
          <span className={`text-4xl font-black ${
            currentProfit < 0 ? 'text-red-600' :
            themeConfig.name === 'simple-light' ? 'text-blue-700' :
            themeConfig.name === 'ninja-green' ? 'text-green-800' :
            'text-white'
          }`}
          style={currentProfit < 0 ? {
            animation: 'blink-red 0.8s ease-in-out infinite'
          } : isGoalReached ? {
            animation: 'pulse-gold 0.6s ease-out'
          } : {}}>
            ${currentProfit.toFixed(0)}
          </span>
          <span className={`text-base font-bold ${
            themeConfig.name === 'simple-light' ? 'text-blue-600' :
            themeConfig.name === 'ninja-green' ? 'text-green-700' :
            'text-slate-400'
          }`}>
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
            ? 'bg-cyan-500/30 border-2 border-cyan-400/50 shadow-lg shadow-cyan-400/30 text-cyan-300'
            : themeConfig.name === 'simple-light'
            ? 'bg-blue-200 border-2 border-blue-300 text-blue-700'
            : themeConfig.name === 'ninja-green'
            ? 'bg-lime-200 border-2 border-lime-400 text-lime-700'
            : 'bg-cyan-500/30 border-2 border-cyan-400/50 text-cyan-300'
        }`}>
          Mission accomplished, ninja! 💵
        </div>
      )}

      {/* Hint text */}
      <div className={`relative z-10 text-sm text-center mt-6 opacity-70 transition-all group-hover:opacity-100 ${
        themeConfig.name === 'simple-light' ? 'text-blue-600' :
        themeConfig.name === 'ninja-green' ? 'text-green-600' :
        'text-cyan-300'
      }`}>
        Click the cash to celebrate • Click to edit your target
      </div>

      {/* Hide button */}
      <div className="absolute bottom-4 right-4 z-20">
        <button
          onClick={() => setIsHidden(true)}
          className={`text-xl font-bold hover:opacity-60 transition-opacity ${
            themeConfig.name === 'simple-light' ? 'text-purple-600' : ''
          }`}
          style={themeConfig.name !== 'simple-light' ? {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
            backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent'
          } : {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0'
          }}
        >
          −
        </button>
      </div>
    </div>
  );
}
