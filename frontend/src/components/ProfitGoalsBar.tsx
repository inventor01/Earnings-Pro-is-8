import { useState, useEffect, useRef } from 'react';
import { api, TimeframeType } from '../lib/api';
import { useTheme } from '../lib/themeContext';

interface ProfitGoalsBarProps {
  timeframe: TimeframeType;
  currentProfit: number;
  goalProgress?: number;
  goalAmount?: string;
  onGoalReached?: (timeframe: TimeframeType) => void;
  onToggle?: () => void;
}

const TIMEFRAME_LABELS: Partial<Record<TimeframeType, string>> = {
  TODAY: "Today's",
  YESTERDAY: "Yesterday's",
  THIS_WEEK: "This Week's",
  LAST_7_DAYS: 'Last 7 Days',
  THIS_MONTH: "This Month's",
  LAST_MONTH: "Last Month's",
};

export function ProfitGoalsBar({ timeframe, currentProfit, goalProgress = 0, goalAmount: initialGoalAmount, onGoalReached, onToggle }: ProfitGoalsBarProps) {
  const { config } = useTheme();
  const isDarkTheme = config.name !== 'ninja-green';
  
  const [goalAmount, setGoalAmount] = useState(initialGoalAmount || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tempGoal, setTempGoal] = useState('');
  const [isGoalReached, setIsGoalReached] = useState(false);
  const [error, setError] = useState('');
  const goalReachedRef = useRef<boolean>(false);

  useEffect(() => {
    // Update goal amount when prop changes
    if (initialGoalAmount) {
      setGoalAmount(initialGoalAmount);
    }
    // Reset goal reached flag when timeframe changes
    goalReachedRef.current = false;
  }, [timeframe, initialGoalAmount]);

  useEffect(() => {
    // Show success message when goal is reached for the first time
    if (goalProgress >= 100 && !goalReachedRef.current && goalAmount) {
      goalReachedRef.current = true;
      setIsGoalReached(true);
      onGoalReached?.(timeframe);
    }
    // Reset when goal progress drops below 100 (e.g., after deleting entries)
    if (goalProgress < 100) {
      goalReachedRef.current = false;
      setIsGoalReached(false);
    }

  }, [goalProgress, goalAmount, timeframe, onGoalReached]);

  const handleEditClick = () => {
    setTempGoal(goalAmount);
    setIsEditing(true);
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
      await api.createGoal(timeframe, parseFloat(tempGoal));
      setGoalAmount(tempGoal);
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

  const progressColor = 'bg-lime-500';
  // Round to avoid floating point issues - if progress is 99.5% or higher, show 100%
  const displayProgress = goalProgress >= 99.5 ? 100 : Math.max(0, Math.min(goalProgress, 100));

  if (!goalAmount) {
    // Show edit form if editing, otherwise show "Set Goal" button
    if (isEditing) {
      return (
        <div className={`w-full px-4 py-3 ${isDarkTheme ? 'bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700' : 'bg-gradient-to-r from-lime-50 to-yellow-50 border-b border-lime-200'}`}>
          <div className="max-w-6xl mx-auto space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${isDarkTheme ? 'text-slate-300' : 'text-gray-600'}`}>{TIMEFRAME_LABELS[timeframe]} Goal:</span>
              <input
                type="number"
                step="0.01"
                value={tempGoal}
                onChange={(e) => setTempGoal(e.target.value)}
                placeholder="Enter goal amount"
                className={`px-3 py-2 border-2 rounded-lg text-sm w-32 focus:outline-none focus:ring-2 transition-all font-medium ${isDarkTheme ? 'bg-slate-700 border-lime-500 text-lime-300 focus:ring-lime-500 focus:border-lime-500' : 'bg-white border-lime-400 text-gray-800 focus:ring-lime-500 focus:border-lime-500'}`}
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`px-3 py-2 text-white text-xs font-bold rounded-lg hover:scale-105 disabled:bg-gray-400 transition-all duration-200 uppercase tracking-wide ${isDarkTheme ? 'bg-gradient-to-r from-lime-600 to-green-700 hover:from-lime-700 hover:to-green-800' : 'bg-gradient-to-r from-lime-500 to-green-700 hover:from-lime-600 hover:to-green-800 hover:shadow-lg'}`}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white text-xs font-bold rounded-lg hover:from-gray-500 hover:to-gray-600 hover:scale-105 transition-all duration-200 uppercase tracking-wide"
              >
                Cancel
              </button>
            </div>
            {error && (
              <div className="text-red-600 text-sm font-medium">
                ⚠️ {error}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={`w-full px-4 py-3 animate-pulse ${isDarkTheme ? 'bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700' : 'bg-gradient-to-r from-lime-50 to-yellow-50 border-b border-lime-200'}`}>
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className={`text-sm ${isDarkTheme ? 'text-slate-300' : 'text-gray-600'}`}>
            <span className="font-medium">{TIMEFRAME_LABELS[timeframe]} Goal:</span> Set a target to track progress
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleEditClick}
              className={`px-3 py-1 text-white text-sm rounded-lg transition-all duration-200 font-medium edit-button-hover ${isDarkTheme ? 'bg-lime-600 hover:bg-lime-700 hover:shadow-lg hover:shadow-lime-500/20' : 'bg-lime-500 hover:bg-lime-600 hover:shadow-lg'}`}
            >
              Set Goal
            </button>
            <button
              onClick={onToggle}
              className={`p-1 transition-colors ${isDarkTheme ? 'text-slate-400 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'}`}
              title="Hide goal banner"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full px-2 md:px-5 py-2 md:py-4 transition-all duration-500 shadow-md ${isDarkTheme ? 'bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 border-b border-slate-700' : 'bg-gradient-to-r from-lime-50 via-yellow-50 to-lime-50 border-b border-lime-300'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Single inline row */}
        <div className="flex items-center gap-1.5 md:gap-4 justify-between">
          <div className="flex items-center gap-1 md:gap-4 flex-nowrap overflow-x-auto scrollbar-hide">
            {/* Label - very compact on mobile */}
            <span className={`text-xs md:text-base lg:text-lg font-bold transition-colors duration-500 goal-label-animated whitespace-nowrap ${isDarkTheme ? 'text-lime-400' : 'text-green-800'}`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              {TIMEFRAME_LABELS[timeframe]} Goal:
            </span>

            {/* Goal Amount Section */}
            {isEditing ? (
              <div className="flex items-center gap-1 md:gap-3 whitespace-nowrap">
                <input
                  type="number"
                  step="0.01"
                  value={tempGoal}
                  onChange={(e) => setTempGoal(e.target.value)}
                  placeholder="Goal"
                  className={`px-2 py-1 border-2 rounded text-xs md:text-base w-16 md:w-28 focus:outline-none focus:ring-2 transition-all font-medium ${isDarkTheme ? 'bg-slate-700 border-lime-500 text-lime-300 focus:ring-lime-500 focus:border-lime-500' : 'bg-white border-lime-400 text-gray-800 focus:ring-lime-500 focus:border-lime-500'}`}
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`px-2 py-1 md:px-3 md:py-2 text-white text-xs font-bold rounded hover:scale-105 disabled:bg-gray-400 transition-all ${isDarkTheme ? 'bg-gradient-to-r from-lime-600 to-green-700 hover:from-lime-700 hover:to-green-800' : 'bg-gradient-to-r from-lime-500 to-green-700 hover:from-lime-600 hover:to-green-800'}`}
                >
                  {isSaving ? '...' : 'OK'}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-2 py-1 md:px-3 md:py-2 bg-gray-400 text-white text-xs font-bold rounded hover:bg-gray-500 transition-all"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 md:gap-2 whitespace-nowrap">
                <span className={`text-xl md:text-3xl lg:text-4xl font-black transition-colors duration-500 ${isDarkTheme ? 'text-lime-400' : 'text-lime-600'}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  ${goalAmount}
                </span>
                <button
                  onClick={handleEditClick}
                  className={`text-xs font-bold transition-all ${isDarkTheme ? 'text-lime-400 hover:text-lime-300' : 'text-lime-600 hover:text-lime-800'}`}
                  title="Edit goal"
                >
                  edit
                </button>
              </div>
            )}

            {/* Separator */}
            <span className={`hidden md:inline text-lg ${isDarkTheme ? 'text-slate-600' : 'text-gray-400'}`}>•</span>

            {/* Progress Info - very compact on mobile */}
            <span className={`text-xs md:text-base lg:text-lg font-bold transition-colors duration-500 flex items-center gap-0.5 md:gap-2 whitespace-nowrap ${isGoalReached ? (isDarkTheme ? 'text-lime-400' : 'text-green-800') : (isDarkTheme ? 'text-slate-300' : 'text-gray-700')}`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              <span>${currentProfit.toFixed(2)}</span>
              <span className={`${isDarkTheme ? 'text-slate-500' : 'text-gray-500'}`}>/</span>
              <span>${goalAmount}</span>
              <span className={`text-xs md:text-sm font-bold ml-1 md:ml-2 ${isDarkTheme ? 'text-lime-400' : 'text-blue-600'}`}>{Math.round(displayProgress)}%</span>
              {isGoalReached && <span className={`text-xs md:text-sm font-bold ${isDarkTheme ? 'text-lime-400' : 'text-green-700'}`}>✓</span>}
            </span>
          </div>

          {/* Close button */}
          <button
            onClick={onToggle}
            className={`p-1 transition-colors flex-shrink-0 ${isDarkTheme ? 'text-slate-400 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'}`}
            title="Hide goal banner"
          >
            <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar - bigger */}
        <div className={`w-full rounded-full h-2.5 md:h-4 overflow-hidden shadow-inner transition-all duration-500 progress-section mt-2 md:mt-2.5 ${isDarkTheme ? 'bg-slate-700 shadow-lime-900/30' : 'bg-gray-300 shadow-lime-300'}`}>
          <div
            className={`h-2.5 md:h-4 rounded-full transition-all duration-500 ease-out progress-bar-fill ${goalProgress > 50 ? 'shimmer-effect' : ''} ${isGoalReached ? 'goal-pulse shadow-lg' : ''} ${isDarkTheme ? 'bg-gradient-to-r from-lime-500 to-lime-400 shadow-lime-500/50' : 'bg-gradient-to-r from-lime-500 to-green-600'}`}
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
