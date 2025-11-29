import { AppType, EntryType, ExpenseCategory } from '../lib/api';
import { CalcMode } from './CalcPad';
import { DistanceCalc } from './DistanceCalc';
import { Period } from './PeriodChips';
import { useEffect, useState } from 'react';
import { getESTDateString } from '../lib/dateUtils';

interface EntryFormProps {
  mode: CalcMode;
  onTypeChange: (type: EntryType) => void;
  formData: EntryFormData;
  onFormDataChange: (data: EntryFormData) => void;
  period?: Period;
  dayOffset?: number;
  isEditing?: boolean;
  showExtraInfo?: boolean;
}

export interface EntryFormData {
  type: EntryType;
  app: AppType;
  distance_miles: string;
  category: ExpenseCategory;
  note: string;
  receipt_url?: string;
  date: string;
  time: string;
  is_business_expense?: boolean;
  during_business_hours?: boolean;
}

export function EntryForm({ onTypeChange, formData, onFormDataChange, period = 'today', dayOffset = 0, isEditing = false, showExtraInfo = true }: EntryFormProps) {
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const isExpense = formData.type === 'EXPENSE';
  const isOrder = formData.type === 'ORDER' || formData.type === 'CANCELLATION';
  const isRevenueEntry = formData.type === 'ORDER';

  // Calculate date constraints based on timeframe (disabled when creating new entries)
  const getDateConstraints = () => {
    const now = new Date();
    const formatDate = (date: Date) => getESTDateString(date.toISOString());

    // Allow any date for new entries and editing - no constraints
    // This ensures entries can be saved to any date regardless of current period view
    // For new entries, always default to today (never respect dayOffset)
    let defaultDate;

    if (isEditing) {
      // When editing, use the period/dayOffset logic
      switch (period) {
        case 'today': {
          const date = new Date();
          date.setDate(date.getDate() + dayOffset);
          defaultDate = formatDate(date);
          break;
        }
        case 'yesterday': {
          const date = new Date();
          date.setDate(date.getDate() - 1);
          defaultDate = formatDate(date);
          break;
        }
        case 'week': {
          defaultDate = formatDate(now);
          break;
        }
        case 'last7': {
          defaultDate = formatDate(now);
          break;
        }
        case 'month': {
          defaultDate = formatDate(now);
          break;
        }
        case 'lastMonth': {
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          defaultDate = formatDate(lastMonthEnd);
          break;
        }
        default:
          defaultDate = formatDate(now);
      }
    } else {
      // For new entries, always use today's date
      defaultDate = formatDate(now);
    }

    return { minDate: '', maxDate: '', defaultDate };
  };

  const { minDate, maxDate, defaultDate } = getDateConstraints();

  // Auto-set date to default when timeframe changes
  useEffect(() => {
    if (!formData.date || formData.date < minDate || formData.date > maxDate) {
      onFormDataChange({ ...formData, date: defaultDate });
    }
  }, [period, dayOffset]);

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg md:rounded-2xl shadow-lg p-4 md:p-6 space-y-3 md:space-y-4">
      {/* Main Form Fields - All shown when showExtraInfo is true */}
      {showExtraInfo && (
        <>
          {/* Type field - Hidden in More Options for revenue, always visible for others */}
          {!isRevenueEntry && (
            <div>
              <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">📝 Type</label>
              <select
                value={formData.type}
                onChange={(e) => {
                  const newType = e.target.value as EntryType;
                  const updatedData = { ...formData, type: newType };
                  if (newType === 'EXPENSE') {
                    updatedData.app = 'OTHER';
                  }
                  onFormDataChange(updatedData);
                  onTypeChange(newType);
                }}
                className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
              >
                <option value="ORDER">Order</option>
                <option value="BONUS">Bonus</option>
                <option value="EXPENSE">Expense</option>
                <option value="CANCELLATION">Cancellation</option>
              </select>
            </div>
          )}

          {/* For ORDER entries - show miles calculator */}
          {isRevenueEntry && (
            <DistanceCalc
              value={formData.distance_miles}
              onValueChange={(value) => onFormDataChange({ ...formData, distance_miles: value })}
            />
          )}

          {/* Conditionally show more options for ORDER */}
          {isRevenueEntry && showMoreOptions && (
            <>
              {/* Type field - shown in more options for ORDER */}
              <div>
                <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">📝 Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => {
                    const newType = e.target.value as EntryType;
                    const updatedData = { ...formData, type: newType };
                    if (newType === 'EXPENSE') {
                      updatedData.app = 'OTHER';
                    }
                    onFormDataChange(updatedData);
                    onTypeChange(newType);
                  }}
                  className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
                >
                  <option value="ORDER">Order</option>
                  <option value="BONUS">Bonus</option>
                  <option value="EXPENSE">Expense</option>
                  <option value="CANCELLATION">Cancellation</option>
                </select>
              </div>

              {!isExpense && (
                <div>
                  <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">🚗 App</label>
                  <select
                    value={formData.app}
                    onChange={(e) => onFormDataChange({ ...formData, app: e.target.value as AppType })}
                    className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
                  >
                    <option value="UBEREATS">UberEats</option>
                    <option value="DOORDASH">DoorDash</option>
                    <option value="INSTACART">Instacart</option>
                    <option value="GRUBHUB">GrubHub</option>
                    <option value="SHIPT">Shipt</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              )}

              {/* Date and Time Fields - shown in more options for ORDER */}
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <div>
                  <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">📅 Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => onFormDataChange({ ...formData, date: e.target.value })}
                    className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">🕐 Time</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => onFormDataChange({ ...formData, time: e.target.value })}
                    className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
                  />
                </div>
              </div>

              {/* Notes Field - shown in more options for ORDER */}
              <div>
                <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">📝 Notes (optional)</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => onFormDataChange({ ...formData, note: e.target.value })}
                  placeholder="Add any notes about this order..."
                  className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* For non-revenue entries - show all fields normally */}
          {!isRevenueEntry && (
            <>
              {!isExpense && (
                <div>
                  <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">🚗 App</label>
                  <select
                    value={formData.app}
                    onChange={(e) => onFormDataChange({ ...formData, app: e.target.value as AppType })}
                    className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
                  >
                    <option value="UBEREATS">UberEats</option>
                    <option value="DOORDASH">DoorDash</option>
                    <option value="INSTACART">Instacart</option>
                    <option value="GRUBHUB">GrubHub</option>
                    <option value="SHIPT">Shipt</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              )}

              {isOrder && (
                <div>
                  <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">🛣️ Distance (miles)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.distance_miles}
                    onChange={(e) => onFormDataChange({ ...formData, distance_miles: e.target.value })}
                    className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
                    placeholder="5.5"
                  />
                </div>
              )}

              {isExpense && (
                <>
                  <div>
                    <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">🏷️ Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => onFormDataChange({ ...formData, category: e.target.value as ExpenseCategory })}
                      className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
                    >
                      <option value="GAS">⛽ Gas</option>
                      <option value="PARKING">🅿️ Parking</option>
                      <option value="TOLLS">🛣️ Tolls</option>
                      <option value="MAINTENANCE">🔧 Maintenance</option>
                      <option value="PHONE">📱 Phone</option>
                      <option value="SUBSCRIPTION">📦 Subscription</option>
                      <option value="FOOD">🍔 Food</option>
                      <option value="LEISURE">🎮 Leisure</option>
                      <option value="OTHER">📋 Other</option>
                    </select>
                  </div>
                  
                  {/* Business Expense Toggle */}
                  <label className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 hover:from-blue-100 hover:to-cyan-100 transition-all duration-200 cursor-pointer group">
                    <span className="flex items-center gap-2 md:gap-3">
                      <span className="text-lg">💼</span>
                      <span className="text-sm md:text-base font-bold text-gray-800">Business Expense</span>
                    </span>
                    <div className="relative inline-block w-12 h-6 transition-colors duration-300 rounded-full" style={{ backgroundColor: formData.is_business_expense ? '#3b82f6' : '#d1d5db' }}>
                      <input
                        type="checkbox"
                        checked={formData.is_business_expense ?? false}
                        onChange={(e) => onFormDataChange({ ...formData, is_business_expense: e.target.checked })}
                        className="hidden"
                      />
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${formData.is_business_expense ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                  </label>
                </>
              )}

              {/* Date and Time Fields - shown normally for non-revenue */}
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <div>
                  <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">📅 Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => onFormDataChange({ ...formData, date: e.target.value })}
                    className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">🕐 Time</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => onFormDataChange({ ...formData, time: e.target.value })}
                    className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {showExtraInfo && (
        <>
          {isExpense && (
            <div>
              <label className="block text-base font-bold text-gray-800 mb-3">📸 Receipt (optional)</label>
              <label className="flex flex-col items-center justify-center w-full px-4 py-6 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 border-2 border-dashed border-gradient-to-r border-purple-300 rounded-xl cursor-pointer hover:from-purple-100 hover:via-pink-100 hover:to-orange-100 transition-all duration-200 group shadow-sm hover:shadow-md">
                <div className="flex flex-col items-center justify-center">
                  <svg className="w-10 h-10 text-purple-500 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm font-bold text-purple-700">Click to upload receipt</p>
                  <p className="text-xs text-purple-500 mt-1">or drag and drop</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        onFormDataChange({ ...formData, receipt_url: base64 });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
              </label>
              {formData.receipt_url && (
                <div className="mt-4">
                  <div className="relative group">
                    <img 
                      src={formData.receipt_url} 
                      alt="Receipt preview" 
                      className="w-full h-48 object-cover rounded-xl border-2 border-purple-300 shadow-lg group-hover:shadow-xl transition-shadow"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-xl transition-all" />
                  </div>
                  <p className="text-xs text-green-600 mt-2 font-semibold">✓ Receipt uploaded</p>
                </div>
              )}
            </div>
          )}

          {/* Hidden options section - toggleable - moved to bottom */}
          {isRevenueEntry && (
            <button
              type="button"
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="w-full py-1 md:py-2 px-2 md:px-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold text-xs md:text-sm text-gray-700 transition-colors"
            >
              {showMoreOptions ? '▼ Hide More Options' : '▶ More Options'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
