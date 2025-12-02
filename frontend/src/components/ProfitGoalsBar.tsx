import { useState, useEffect, useRef } from 'react';
import { api, TimeframeType } from '../lib/api';
import { useTheme } from '../lib/themeContext';

interface ProfitGoalsBarProps {
  timeframe: TimeframeType;
  currentProfit: number;
  goalProgress?: number;
  goalAmount?: string;
  onGoalReached?: (timeframe: TimeframeType) => void;
  onMilestoneReached?: (milestone: 25 | 50 | 75 | 100) => void;
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

export function ProfitGoalsBar({ timeframe, currentProfit, goalProgress = 0, goalAmount: initialGoalAmount, onGoalReached, onMilestoneReached, onToggle }: ProfitGoalsBarProps) {
  const { config } = useTheme();
  const isDarkTheme = config.name !== 'ninja-green';
  
  const [goalAmount, setGoalAmount] = useState(initialGoalAmount || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tempGoal, setTempGoal] = useState('');
  const [isGoalReached, setIsGoalReached] = useState(false);
  const [error, setError] = useState('');
  const goalReachedRef = useRef<boolean>(false);
  const milestonesReachedRef = useRef<Set<25 | 50 | 75 | 100>>(new Set());

  useEffect(() => {
    // Update goal amount when prop changes
    if (initialGoalAmount) {
      setGoalAmount(initialGoalAmount);
    }
    // Reset goal reached flag when timeframe changes
    goalReachedRef.current = false;
    milestonesReachedRef.current.clear();
  }, [timeframe, initialGoalAmount]);

  useEffect(() => {
    // Check milestone achievements (exclude 100% - that gets its own goal reached message)
    const milestones: (25 | 50 | 75)[] = [25, 50, 75];
    for (const milestone of milestones) {
      if (goalProgress >= milestone && !milestonesReachedRef.current.has(milestone)) {
        milestonesReachedRef.current.add(milestone);
        onMilestoneReached?.(milestone);
      }
    }

    // Show success message when goal is reached for the first time (100% completion)
    if (goalProgress >= 100 && !goalReachedRef.current && goalAmount) {
      goalReachedRef.current = true;
      setIsGoalReached(true);
      // Trigger 100% milestone message as the single completion alert
      if (!milestonesReachedRef.current.has(100)) {
        milestonesReachedRef.current.add(100);
        onMilestoneReached?.(100);
      }
      onGoalReached?.(timeframe);
    }
    // Reset when goal progress drops below 100 (e.g., after deleting entries)
    if (goalProgress < 100) {
      goalReachedRef.current = false;
      setIsGoalReached(false);
      // Also reset milestones if progress drops significantly
      if (goalProgress < 25) {
        milestonesReachedRef.current.clear();
      }
    }

  }, [goalProgress, goalAmount, timeframe, onGoalReached, onMilestoneReached]);

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

  // Always render the progress bar, even without a goal
  const hasGoal = !!goalAmount;

  // Edit form - shown when editing even without goal
  if (isEditing) {
    return (
      <div className="w-full px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="max-w-6xl mx-auto space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-yellow-400">{TIMEFRAME_LABELS[timeframe]} Goal:</span>
            <input
              type="number"
              step="0.01"
              value={tempGoal}
              onChange={(e) => setTempGoal(e.target.value)}
              placeholder="Enter goal amount"
              className="px-3 py-2 border-2 rounded-lg text-sm w-32 focus:outline-none focus:ring-2 transition-all font-medium bg-gray-800 border-gray-600 text-white focus:ring-yellow-500 focus:border-yellow-500"
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-2 bg-yellow-500 text-gray-900 text-xs font-bold rounded-lg hover:bg-yellow-400 hover:scale-105 disabled:bg-gray-600 transition-all duration-200 uppercase tracking-wide"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-2 bg-gray-700 text-white text-xs font-bold rounded-lg hover:bg-gray-600 hover:scale-105 transition-all duration-200 uppercase tracking-wide"
            >
              Cancel
            </button>
          </div>
          {error && (
            <div className="text-red-400 text-sm font-medium bg-red-900/50 px-2 py-1 rounded">
              ⚠️ {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // No goal set - show placeholder with Set Goal button
  if (!hasGoal) {
    return (
      <div className="w-full px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="text-sm text-gray-300">
            <span className="font-medium text-yellow-400">{TIMEFRAME_LABELS[timeframe]} Goal:</span> Set a target to track progress
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleEditClick}
              className="px-3 py-1 bg-yellow-500 text-gray-900 text-sm rounded-lg transition-all duration-200 font-medium hover:bg-yellow-400 hover:shadow-lg"
            >
              Set Goal
            </button>
            <button
              onClick={onToggle}
              className="p-1 transition-colors text-gray-400 hover:text-yellow-400"
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
    <div className="w-full px-2 md:px-5 py-2 md:py-4 transition-all duration-500 shadow-md bg-gray-900 border-b border-gray-800">
      <div className="max-w-6xl mx-auto">
        {/* Single inline row */}
        <div className="flex items-center gap-1.5 md:gap-4 justify-between">
          <div className="flex items-center gap-1 md:gap-4 flex-nowrap overflow-x-auto scrollbar-hide">
            {/* Label - very compact on mobile */}
            <span className="text-xs md:text-base lg:text-lg font-bold transition-colors duration-500 goal-label-animated whitespace-nowrap text-yellow-400" style={{ fontFamily: "'Poppins', sans-serif" }}>
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
                  className="px-2 py-1 border-2 rounded text-xs md:text-base w-16 md:w-28 focus:outline-none focus:ring-2 transition-all font-medium bg-gray-800 border-gray-600 text-white focus:ring-yellow-500 focus:border-yellow-500"
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-2 py-1 md:px-3 md:py-2 bg-yellow-500 text-gray-900 text-xs font-bold rounded hover:bg-yellow-400 hover:scale-105 disabled:bg-gray-600 transition-all"
                >
                  {isSaving ? '...' : 'OK'}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-2 py-1 md:px-3 md:py-2 bg-gray-700 text-white text-xs font-bold rounded hover:bg-gray-600 transition-all"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 md:gap-2 whitespace-nowrap">
                <span className="text-xl md:text-3xl lg:text-4xl font-black transition-colors duration-500 text-yellow-400" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  ${goalAmount}
                </span>
                <button
                  onClick={handleEditClick}
                  className="text-xs font-bold transition-all text-gray-400 hover:text-yellow-400"
                  title="Edit goal"
                >
                  edit
                </button>
              </div>
            )}

            {/* Separator */}
            <span className="hidden md:inline text-lg text-gray-500">•</span>

            {/* Progress Info - very compact on mobile */}
            <span className={`text-xs md:text-base lg:text-lg font-bold transition-colors duration-500 flex items-center gap-0.5 md:gap-2 whitespace-nowrap ${isGoalReached ? 'text-green-400' : 'text-gray-300'}`} style={{ fontFamily: "'Poppins', sans-serif" }}>
              <span>${currentProfit.toFixed(2)}</span>
              <span className="text-gray-500">/</span>
              <span>${goalAmount}</span>
              <span className="text-xs md:text-sm font-bold ml-1 md:ml-2 text-yellow-400">{Math.round(displayProgress)}%</span>
              {isGoalReached && <span className="text-xs md:text-sm font-bold text-green-400">✓</span>}
            </span>
          </div>

          {/* Close button */}
          <button
            onClick={onToggle}
            className="p-1 transition-colors flex-shrink-0 text-gray-400 hover:text-yellow-400"
            title="Hide goal banner"
          >
            <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar - bigger */}
        <div className="w-full rounded-full h-2.5 md:h-4 overflow-hidden shadow-inner transition-all duration-500 progress-section mt-2 md:mt-2.5 bg-gray-700">
          <div
            className={`h-2.5 md:h-4 rounded-full transition-all duration-500 ease-out progress-bar-fill ${goalProgress > 50 ? 'shimmer-effect' : ''} ${isGoalReached ? 'goal-pulse shadow-lg' : ''} bg-gradient-to-r from-yellow-500 to-yellow-400`}
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
