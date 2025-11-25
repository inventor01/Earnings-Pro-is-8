import { useState, useEffect, useRef } from 'react';
import { api, TimeframeType } from '../lib/api';

interface ProfitGoalsBarProps {
  timeframe: TimeframeType;
  currentProfit: number;
  goalProgress?: number;
  onGoalReached?: (timeframe: TimeframeType) => void;
  onToggle?: () => void;
}

const TIMEFRAME_LABELS: Record<TimeframeType, string> = {
  TODAY: "Today's",
  YESTERDAY: "Yesterday's",
  THIS_WEEK: "This Week's",
  LAST_7_DAYS: 'Last 7 Days',
  THIS_MONTH: "This Month's",
  LAST_MONTH: "Last Month's",
};

export function ProfitGoalsBar({ timeframe, currentProfit, goalProgress = 0, onGoalReached, onToggle }: ProfitGoalsBarProps) {
  const [goalAmount, setGoalAmount] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tempGoal, setTempGoal] = useState('');
  const [isGoalReached, setIsGoalReached] = useState(false);
  const [percentageKey, setPercentageKey] = useState(0);
  const [error, setError] = useState('');
  const goalReachedRef = useRef<boolean>(false);
  const previousProgressRef = useRef(0);

  useEffect(() => {
    // Load current goal on mount and when timeframe changes
    api.getGoal(timeframe).then(goal => {
      if (goal) {
        setGoalAmount(goal.target_profit.toString());
      } else {
        setGoalAmount('');
      }
    });
    // Reset goal reached flag when timeframe changes
    goalReachedRef.current = false;
  }, [timeframe]);

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

    // Trigger animation when percentage changes significantly
    if (Math.round(goalProgress) !== Math.round(previousProgressRef.current)) {
      setPercentageKey(prev => prev + 1);
      previousProgressRef.current = goalProgress;
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

  const progressColor = 'bg-blue-500';
  const displayProgress = Math.min(goalProgress, 100);

  if (!goalAmount) {
    // Show edit form if editing, otherwise show "Set Goal" button
    if (isEditing) {
      return (
        <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-4 py-3">
          <div className="max-w-6xl mx-auto space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">{TIMEFRAME_LABELS[timeframe]} Goal:</span>
              <input
                type="number"
                step="0.01"
                value={tempGoal}
                onChange={(e) => setTempGoal(e.target.value)}
                placeholder="Enter goal amount"
                className="px-3 py-2 border-2 border-blue-400 rounded-lg text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold rounded-lg hover:from-blue-700 hover:to-blue-600 hover:shadow-lg hover:scale-105 disabled:bg-gray-400 transition-all duration-200 uppercase tracking-wide"
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
      <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-4 py-3 animate-pulse">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{TIMEFRAME_LABELS[timeframe]} Goal:</span> Set a target to track progress
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleEditClick}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 hover:shadow-lg transition-all duration-200 font-medium edit-button-hover"
            >
              Set Goal
            </button>
            <button
              onClick={onToggle}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
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
    <div className={`w-full bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-b border-blue-300 px-4 py-4 transition-all duration-500 shadow-md`}>
      <div className="max-w-6xl mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <span className={`text-base md:text-lg font-bold transition-colors duration-500 goal-label-animated text-blue-700`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              {TIMEFRAME_LABELS[timeframe]} Goal:
            </span>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={tempGoal}
                  onChange={(e) => setTempGoal(e.target.value)}
                  placeholder="Goal amount"
                  className="px-3 py-2 border-2 border-blue-400 rounded-lg text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold rounded-lg hover:from-blue-700 hover:to-blue-600 hover:shadow-lg hover:scale-105 disabled:bg-gray-400 transition-all duration-200 uppercase tracking-wide"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white text-xs font-bold rounded-lg hover:from-gray-500 hover:to-gray-600 hover:scale-105 transition-all duration-200 uppercase tracking-wide"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-2xl md:text-3xl font-black transition-colors duration-500 text-blue-600`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  ${goalAmount}
                </span>
                <button
                  onClick={handleEditClick}
                  className="text-xs md:text-sm text-blue-600 hover:text-blue-800 hover:scale-110 underline font-bold transition-all duration-200 edit-button-hover uppercase"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm md:text-base font-bold transition-colors duration-500 flex items-center gap-2 ${isGoalReached ? 'text-blue-700' : 'text-gray-700'}`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              <span>${currentProfit.toFixed(2)}</span>
              <span className="text-gray-500">/</span>
              <span>${goalAmount}</span>
              <span key={percentageKey} className={`ml-1 font-black text-lg md:text-xl percentage-display inline-block text-blue-600`} style={{ fontFamily: "'Outfit', sans-serif" }}>
                {Math.round(goalProgress)}%
              </span>
            </span>
            <button
              onClick={onToggle}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
              title="Hide goal banner"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className={`w-full bg-gray-300 rounded-full h-4 overflow-hidden shadow-inner transition-all duration-500 progress-section shadow-blue-300`}>
          <div
            className={`${progressColor} h-4 rounded-full transition-all duration-500 ease-out progress-bar-fill ${goalProgress > 50 ? 'shimmer-effect' : ''} ${isGoalReached ? 'goal-pulse shadow-lg' : ''}`}
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
