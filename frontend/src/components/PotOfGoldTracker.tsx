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
  const [floatingShuriken, setFloatingShuriken] = useState<number[]>([]);
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

  const currentProfit = Math.max(0, parseFloat(String(monthlyData?.profit)) || 0);
  const goalAmount = parseFloat(String(monthlyGoal?.target_profit)) || 0;
  
  const progressPercent = goalAmount > 0 ? Math.round(Math.min(Math.max(0, (currentProfit / goalAmount) * 100), 100) * 100) / 100 : 0;
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
            Monthly Earnings Target
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
              Set a monthly earnings target to track your ninja progress
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
            Set Earnings Target
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
                ⭐
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
      <div className="relative z-10 flex items-start justify-between mb-3 gap-3">
        <div className="cursor-pointer" onClick={handleEditClick}>
          <h3 className={`font-black text-lg md:text-xl mb-1 ${
            themeConfig.name === 'simple-light' ? 'text-blue-700' :
            themeConfig.name === 'ninja-green' ? 'text-green-800' :
            'text-white'
          }`}>
            Monthly Earnings Target
          </h3>
          <p className={`text-xs md:text-sm font-semibold ${
            themeConfig.name === 'simple-light' ? 'text-blue-600' :
            themeConfig.name === 'ninja-green' ? 'text-green-700' :
            'text-slate-300'
          }`}>
            {Math.min(100, Math.round(progressPercent))}% mission complete
          </p>
        </div>
        <div 
          onClick={triggerShuriken}
          className="text-5xl md:text-6xl cursor-pointer hover:scale-125 transition-transform"
          style={{
            animation: 'pulse-gold 1.5s ease-in-out infinite',
            filter: 'drop-shadow(0 0 10px rgba(34, 211, 238, 0.8))'
          }}
        >
          💵
        </div>
      </div>

      {/* Ninja stars decoration */}
      <div className="relative z-10 flex justify-between items-center mb-8 opacity-80">
      </div>

      {/* Ninja mission progress bars */}
      <div className="relative z-10 mb-3 h-12 group/rainbow">
        <div className="absolute inset-0 flex items-end justify-between gap-1.5 px-2">
          {[...Array(5)].map((_, i) => {
            const barFillPercent = (i + 1) / 5;
            const isFilled = progressPercent / 100 >= barFillPercent;
            const colors = themeConfig.name === 'simple-light' 
              ? ['bg-blue-400', 'bg-blue-500', 'bg-teal-400', 'bg-teal-500', 'bg-cyan-400']
              : themeConfig.name === 'ninja-green'
              ? ['bg-lime-400', 'bg-lime-500', 'bg-green-600', 'bg-yellow-400', 'bg-yellow-500']
              : ['bg-red-400', 'bg-yellow-400', 'bg-green-400', 'bg-blue-400', 'bg-purple-400'];
            const colorRgb = themeConfig.name === 'simple-light'
              ? ['rgb(96, 165, 250)', 'rgb(59, 130, 246)', 'rgb(20, 184, 166)', 'rgb(14, 165, 233)', 'rgb(34, 211, 238)']
              : themeConfig.name === 'ninja-green'
              ? ['rgb(163, 230, 53)', 'rgb(132, 204, 22)', 'rgb(21, 128, 61)', 'rgb(250, 204, 21)', 'rgb(234, 179, 8)']
              : ['rgb(248, 113, 113)', 'rgb(250, 204, 21)', 'rgb(74, 222, 128)', 'rgb(96, 165, 250)', 'rgb(192, 132, 250)'];
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-500 transform group-hover/rainbow:scale-y-110 ${
                  isFilled
                    ? colors[i]
                    : themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green' ? 'bg-blue-100' : 'bg-gray-700'
                }`}
                style={{
                  height: `${24 + i * 8}px`,
                  opacity: isFilled ? 1 : 0.2,
                  boxShadow: isFilled ? `0 0 15px ${colorRgb[i]}` : 'none'
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Progress bar with glow */}
      <div className={`relative z-10 h-4 rounded-full overflow-hidden mb-3 border-2 border-opacity-50 ${
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
      <div className="relative z-10 flex items-center justify-between mb-2 gap-2">
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
