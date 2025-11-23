import { useState, useEffect, useRef } from 'react';
import { api, TimeframeType } from '../lib/api';

interface ProfitGoalsBarProps {
  timeframe: TimeframeType;
  currentProfit: number;
  goalProgress?: number;
  onGoalReached?: (timeframe: TimeframeType) => void;
}

const TIMEFRAME_LABELS: Record<TimeframeType, string> = {
  TODAY: 'Today',
  YESTERDAY: 'Yesterday',
  THIS_WEEK: 'This Week',
  LAST_7_DAYS: 'Last 7 Days',
  THIS_MONTH: 'This Month',
  LAST_MONTH: 'Last Month',
};

export function ProfitGoalsBar({ timeframe, currentProfit, goalProgress = 0, onGoalReached }: ProfitGoalsBarProps) {
  const [goalAmount, setGoalAmount] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tempGoal, setTempGoal] = useState('');
  const goalReachedRef = useRef<boolean>(false);

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
      onGoalReached?.(timeframe);
    }
    // Reset when goal progress drops below 100 (e.g., after deleting entries)
    if (goalProgress < 100) {
      goalReachedRef.current = false;
    }
  }, [goalProgress, goalAmount, timeframe, onGoalReached]);

  const handleEditClick = () => {
    setTempGoal(goalAmount);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (tempGoal && parseFloat(tempGoal) > 0) {
        await api.createGoal(timeframe, parseFloat(tempGoal));
        setGoalAmount(tempGoal);
      }
    } catch (e) {
      console.error('Failed to save goal:', e);
    }
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const progressColor = goalProgress > 100 ? 'bg-green-500' : 'bg-blue-500';
  const displayProgress = Math.min(goalProgress, 100);

  if (!goalAmount) {
    return (
      <div className="w-full bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{TIMEFRAME_LABELS[timeframe]} Goal:</span> Set a target to track progress
          </div>
          <button
            onClick={handleEditClick}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 font-medium"
          >
            Set Goal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 px-4 py-3">
      <div className="max-w-6xl mx-auto space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
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
                  className="px-2 py-1 border border-gray-300 rounded-lg text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-2 py-1 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 disabled:bg-gray-400 font-medium"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-400 font-medium"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blue-600">${goalAmount}</span>
                <button
                  onClick={handleEditClick}
                  className="text-xs text-blue-600 hover:text-blue-700 underline font-medium"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
          <span className="text-sm font-semibold text-gray-700">
            ${currentProfit.toFixed(2)} / ${goalAmount}
            <span className={`ml-2 ${goalProgress > 100 ? 'text-green-600' : 'text-blue-600'}`}>
              {Math.round(goalProgress)}%
            </span>
          </span>
        </div>
        <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
          <div
            className={`${progressColor} h-2 rounded-full transition-all duration-300`}
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
