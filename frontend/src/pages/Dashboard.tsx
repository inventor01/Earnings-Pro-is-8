import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Entry, EntryCreate, EntryType, TimeframeType } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { PeriodChips, Period } from '../components/PeriodChips';
import ninjaLogo from '../assets/logo-ninja.png';
import { KpiCard } from '../components/KpiCard';
import { SummaryCard, MetricVisibility } from '../components/SummaryCard';
import { CalcPad, CalcMode } from '../components/CalcPad';
import { EntryForm, EntryFormData } from '../components/EntryForm';
import { EntriesTable } from '../components/EntriesTable';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import { ProfitGoalsBar } from '../components/ProfitGoalsBar';
import { AISuggestions } from '../components/AISuggestions';
import { EntryViewer } from '../components/EntryViewer';
import { FeatureTour } from '../components/FeatureTour';
// import { PointsCard } from '../components/PointsCard';
import { ShareCard } from '../components/ShareCard';
import { PotOfGoldTracker } from '../components/PotOfGoldTracker';
import { AchievementsModal } from '../components/AchievementsModal';
import { ProfitCalendar } from '../components/ProfitCalendar';
import { useTheme } from '../lib/themeContext';
import { useSimpleMode } from '../lib/simpleModeContext';
import { getESTTimeComponents, getESTDateString } from '../lib/dateUtils';
import { exportToCSV } from '../lib/csvExport';

interface DashboardProps {
  onNavigateToLeaderboard?: () => void;
}

export function Dashboard({ onNavigateToLeaderboard }: DashboardProps) {
  const { logout } = useAuth();
  const { isSimple } = useSimpleMode();
  const [period, setPeriod] = useState<Period>('today');
  const [amount, setAmount] = useState('0');
  const [mode, setMode] = useState<CalcMode>('add');
  const [, setEntryType] = useState<EntryType>('ORDER');
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, -1 = yesterday, 1 = tomorrow, etc.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const getDefaultDate = () => {
    const now = new Date();
    return getESTDateString(now.toISOString());
  };

  const getDefaultTime = () => {
    const now = new Date();
    const { hours, minutes } = getESTTimeComponents(now.toISOString());
    return `${hours}:${minutes}`;
  };

  const getDateLabel = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    
    if (offset === 0) {
      return 'Today';
    } else if (offset === -1) {
      return 'Yesterday';
    } else if (offset === 1) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const [formData, setFormData] = useState<EntryFormData>({
    type: 'ORDER',
    app: 'UBEREATS',
    distance_miles: '',
    category: 'GAS',
    note: '',
    receipt_url: undefined,
    date: getDefaultDate(),
    time: getDefaultTime(),
  });
  const [showSettings, setShowSettings] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetAllConfirm, setResetAllConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [calcExpanded, setCalcExpanded] = useState(false);
  const [entryFormStep, setEntryFormStep] = useState(0); // 0 = calculator, 1 = form fields
  const [showShareCard, setShowShareCard] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null);
  const [editingFormData, setEditingFormData] = useState<EntryFormData>({
    type: 'ORDER',
    app: 'UBEREATS',
    distance_miles: '',
    category: 'GAS',
    note: '',
    receipt_url: undefined,
    date: getDefaultDate(),
    time: getDefaultTime(),
  });
  const [showGoalBanner, setShowGoalBanner] = useState(true);
  
  const [showNegativeAlert, setShowNegativeAlert] = useState(true);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showPerformanceOverview, setShowPerformanceOverview] = useState(true);
  
  const [metricVisibility, setMetricVisibility] = useState<Partial<MetricVisibility>>(() => {
    const saved = localStorage.getItem('metricVisibility');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showFeatureTour, setShowFeatureTour] = useState(() => {
    const hasCompletedTour = localStorage.getItem('hasCompletedFeatureTour');
    // Show tour on first load only - when hasCompletedTour is not set
    return hasCompletedTour === null;
  });
  
  const handleCloseTour = () => {
    localStorage.setItem('hasCompletedFeatureTour', 'true');
    setShowFeatureTour(false);
  };
  
  const handleRestartTour = () => {
    localStorage.removeItem('hasCompletedFeatureTour');
    setShowFeatureTour(true);
  };

  const handleMetricVisibilityChange = (visibility: Partial<MetricVisibility>) => {
    setMetricVisibility(visibility);
    localStorage.setItem('metricVisibility', JSON.stringify(visibility));
  };

  const queryClient = useQueryClient();

  // Check if date has changed and auto-reset if needed
  useEffect(() => {
    const today = new Date().toDateString();
    const lastVisitDate = localStorage.getItem('lastVisitDate');
    
    if (lastVisitDate && lastVisitDate !== today) {
      // Date has changed - reset to yesterday and show notification
      setToast({ message: 'New day! Previous data moved to Yesterday.', type: 'success' });
    }
    
    localStorage.setItem('lastVisitDate', today);
  }, []);

  // Listen for tour events to expand/close calculator
  useEffect(() => {
    const handleTourCalculatorStep = () => {
      setCalcExpanded(true);
    };
    
    const handleTourCalculatorClose = () => {
      setCalcExpanded(false);
    };
    
    window.addEventListener('tour-calculator-step', handleTourCalculatorStep);
    window.addEventListener('tour-calculator-close', handleTourCalculatorClose);
    return () => {
      window.removeEventListener('tour-calculator-step', handleTourCalculatorStep);
      window.removeEventListener('tour-calculator-close', handleTourCalculatorClose);
    };
  }, []);

  useEffect(() => {
    setSelectedIds([]);
    // Reset day offset when period changes
    if (period === 'yesterday') {
      // For 'yesterday' period, ensure dayOffset stays at 0 to show yesterday's data
      setDayOffset(0);
    } else if (period !== 'today') {
      // For other periods (week, month, etc), reset dayOffset
      setDayOffset(0);
    }
    // For 'today', keep the existing dayOffset as user might be navigating between days
  }, [period]);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const getTimeframe = (p: Period): string => {
    const mapping: Record<Period, string> = {
      'today': 'TODAY',
      'yesterday': 'YESTERDAY',
      'week': 'THIS_WEEK',
      'last7': 'LAST_7_DAYS',
      'month': 'THIS_MONTH',
      'lastMonth': 'LAST_MONTH',
      'custom': 'TODAY',
    };
    return mapping[p] || 'TODAY';
  };

  const getPeriodLabel = (): string => {
    if (period === 'today') {
      return 'Today';
    } else if (period === 'yesterday') {
      return 'Yesterday';
    } else if (period === 'week') {
      return 'This Week';
    } else if (period === 'last7') {
      return 'Last 7 Days';
    } else if (period === 'month') {
      return 'This Month';
    } else if (period === 'lastMonth') {
      return 'Last Month';
    }
    return period.charAt(0).toUpperCase() + period.slice(1);
  };

  // Use backend's date calculation to avoid timezone issues
  const rollupTimeframe = getTimeframe(period);

  const { data: rollup, refetch: refetchRollup } = useQuery({
    queryKey: ['rollup', period, dayOffset],
    queryFn: () => api.getRollup(
      rollupTimeframe,
      period === 'today' ? dayOffset : undefined
    ),
  });

  const { data: entries = [], refetch: refetchEntries } = useQuery({
    queryKey: ['entries', period, dayOffset],
    queryFn: () => api.getEntries(
      rollupTimeframe,
      period === 'today' ? dayOffset : undefined
    ),
  });

  const { data: monthlyEntries = [] } = useQuery({
    queryKey: ['entries', 'THIS_MONTH'],
    queryFn: () => api.getEntries('THIS_MONTH'),
  });

  const { data: monthlyGoal } = useQuery({
    queryKey: ['goal', 'THIS_MONTH'],
    queryFn: () => api.getGoal('THIS_MONTH'),
  });

  const createMutation = useMutation({
    mutationFn: api.createEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['rollup'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['goal'], exact: false });
      // Force immediate refetch to ensure entries appear
      refetchEntries();
      refetchRollup();
      setAmount('0');
      setToast({ message: 'Entry added successfully!', type: 'success' });
    },
    onError: () => {
      setToast({ message: 'Failed to add entry', type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['rollup'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['goal'], exact: false });
      setToast({ message: 'Entry deleted successfully!', type: 'success' });
    },
    onError: () => {
      setToast({ message: 'Failed to delete entry', type: 'error' });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => api.deleteEntry(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['rollup'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['goal'], exact: false });
      setSelectedIds([]);
      setToast({ message: `${selectedIds.length} entries deleted successfully!`, type: 'success' });
    },
    onError: () => {
      setToast({ message: 'Failed to delete entries', type: 'error' });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'], exact: false });
      setToast({ message: 'Settings updated!', type: 'success' });
    },
  });

  const resetTodayMutation = useMutation({
    mutationFn: async () => {
      // Delete all entries from today
      const todayEntries = entries.filter(e => {
        const entryDate = new Date(e.timestamp).toDateString();
        const today = new Date().toDateString();
        return entryDate === today;
      });
      await Promise.all(todayEntries.map(e => api.deleteEntry(e.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['rollup'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['goal'], exact: false });
      setResetConfirm(false);
      setToast({ message: "Today's data has been reset!", type: 'success' });
    },
    onError: () => {
      setToast({ message: 'Failed to reset today data', type: 'error' });
    },
  });

  const resetAllMutation = useMutation({
    mutationFn: api.deleteAllEntries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['rollup'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['goal'], exact: false });
      setResetAllConfirm(false);
      setToast({ message: 'All data has been reset!', type: 'success' });
    },
    onError: () => {
      setToast({ message: 'Failed to reset all data', type: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; entry: EntryCreate }) =>
      api.updateEntry(data.id, data.entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['rollup'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['goal'], exact: false });
      setEditingEntry(null);
      setToast({ message: 'Entry updated successfully!', type: 'success' });
    },
    onError: () => {
      setToast({ message: 'Failed to update entry', type: 'error' });
    },
  });

  const handleSave = () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum === 0) {
      setToast({ message: 'Please enter a valid amount', type: 'error' });
      setMode('add');
      return;
    }

    const finalAmount = Math.abs(amountNum);

    // Send date and time separately to backend for proper EST timezone handling
    const entry: EntryCreate = {
      date: formData.date,
      time: formData.time,
      type: formData.type,
      app: formData.app,
      amount: finalAmount,
      distance_miles: formData.distance_miles ? parseFloat(formData.distance_miles) : 0,
      category: (formData.type === 'EXPENSE' && formData.category) ? formData.category : undefined,
      note: formData.note || undefined,
      receipt_url: formData.receipt_url || undefined,
    };

    createMutation.mutate(entry);
    
    setFormData({
      type: formData.type,
      app: formData.app,
      distance_miles: '',
      category: 'GAS',
      note: '',
      receipt_url: undefined,
      date: getDefaultDate(),
      time: getDefaultTime(),
    });
  };

  const handleDelete = (id: number) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const confirmBulkDelete = () => {
    if (selectedIds.length > 0) {
      bulkDeleteMutation.mutate(selectedIds);
      setBulkDeleteConfirm(false);
    }
  };


  const confirmReset = () => {
    resetTodayMutation.mutate();
  };

  const confirmResetAll = () => {
    resetAllMutation.mutate();
  };

  const getTimeframeFromPeriod = (p: Period): TimeframeType => {
    const mapping: Record<Period, TimeframeType> = {
      'today': 'TODAY',
      'yesterday': 'YESTERDAY',
      'week': 'THIS_WEEK',
      'last7': 'LAST_7_DAYS',
      'month': 'THIS_MONTH',
      'lastMonth': 'LAST_MONTH',
      'custom': 'TODAY',
    };
    return mapping[p] || 'TODAY';
  };

  const timeframeLabels: Record<TimeframeType, string> = {
    TODAY: 'Today',
    YESTERDAY: 'Yesterday',
    THIS_WEEK: 'This Week',
    LAST_7_DAYS: 'Last 7 Days',
    THIS_MONTH: 'This Month',
    LAST_MONTH: 'Last Month',
  };

  const handleGoalReached = (tf: TimeframeType) => {
    setToast({
      message: `🎉 Congratulations! You've reached your ${timeframeLabels[tf].toLowerCase()} profit goal!`,
      type: 'success',
    });
  };

  const handleModeChange = (newMode: CalcMode) => {
    setMode(newMode);
    // Auto-select entry type based on mode
    if (newMode === 'add') {
      // Revenue selected - pre-select ORDER
      setFormData(prev => ({
        ...prev,
        type: 'ORDER',
      }));
      setEntryType('ORDER');
    } else if (newMode === 'subtract') {
      // Expense selected - pre-select EXPENSE
      setFormData(prev => ({
        ...prev,
        type: 'EXPENSE',
        app: 'OTHER', // Set app to OTHER for expenses
        date: prev.date,
        time: prev.time,
      }));
      setEntryType('EXPENSE');
    }
  };

  const handleEditEntry = (entry: Entry) => {
    // Parse timestamp to EST date and time
    const date = getESTDateString(entry.timestamp);
    
    // Get EST time components (handles timezone conversion correctly)
    const { hours, minutes } = getESTTimeComponents(entry.timestamp);
    const time = `${hours}:${minutes}`;

    setEditingEntry(entry);
    setAmount(Math.abs(entry.amount).toString());
    setEditingFormData({
      type: entry.type,
      app: entry.app,
      distance_miles: entry.distance_miles.toString(),
      category: entry.category as any || 'GAS',
      note: entry.note || '',
      receipt_url: entry.receipt_url,
      date,
      time,
    });
  };

  const handleSaveEdit = () => {
    if (!editingEntry) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum === 0) {
      setToast({ message: 'Please enter a valid amount', type: 'error' });
      return;
    }

    const finalAmount = Math.abs(amountNum);

    // Send date and time separately to backend for proper EST timezone handling
    const entry: EntryCreate = {
      date: editingFormData.date,
      time: editingFormData.time,
      type: editingFormData.type,
      app: editingFormData.app,
      amount: finalAmount,
      distance_miles: editingFormData.distance_miles ? parseFloat(editingFormData.distance_miles) : 0,
      category: (editingFormData.type === 'EXPENSE' && editingFormData.category) ? editingFormData.category : undefined,
      note: editingFormData.note || undefined,
      receipt_url: editingFormData.receipt_url || undefined,
    };

    updateMutation.mutate({ id: editingEntry.id, entry });
    setAmount('0');
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setAmount('0');
    // Reset from mileage calculator to expense/revenue calculator
    setFormData(prev => ({
      ...prev,
      distance_miles: '',
    }));
    setMode('add');
  };

  const handleToggleGoalBanner = () => {
    setShowGoalBanner(prev => !prev);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchRollup(), refetchEntries()]);
      setToast({ message: 'Data refreshed!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to refresh data', type: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    if (!rollup) {
      setToast({ message: 'No data to export', type: 'error' });
      return;
    }

    try {
      exportToCSV({
        entries: entries,
        revenue: rollup.revenue,
        expenses: rollup.expenses,
        profit: rollup.profit,
        miles: rollup.miles,
        timeframe: getPeriodLabel(),
      });
      setToast({ message: 'Data exported successfully!', type: 'success' });
    } catch {
      setToast({ message: 'Failed to export data', type: 'error' });
    }
  };

  // Filter entries based on search query
  const filteredEntries = searchQuery.trim() === '' 
    ? entries 
    : entries.filter(entry => {
        const query = searchQuery.toLowerCase();
        return (
          entry.note?.toLowerCase().includes(query) ||
          entry.app?.toLowerCase().includes(query) ||
          entry.category?.toLowerCase().includes(query) ||
          entry.type?.toLowerCase().includes(query) ||
          entry.amount.toString().includes(query)
        );
      });

  const { config } = useTheme();
  const isDarkTheme = config.name !== 'simple-light' && config.name !== 'ninja-green';

  const dashboardClass = `min-h-screen ${config.dashBg} ${config.dashFrom} ${config.dashTo} ${config.dashVia ? config.dashVia : ''} flex flex-col`;

  const contentClass = `flex-1 overflow-y-auto max-w-7xl lg:max-w-8xl mx-auto px-3 md:px-6 lg:px-8 py-4 md:py-8 lg:py-10 pb-24 w-full ${config.dashBg} ${config.dashFrom} ${config.dashTo} ${config.dashVia ? config.dashVia : ''}`;

  return (
    <div className={dashboardClass}>
      {rollup && showGoalBanner && (
        <ProfitGoalsBar
          timeframe={getTimeframeFromPeriod(period)}
          currentProfit={rollup.profit}
          goalProgress={rollup.goal_progress ?? 0}
          onGoalReached={handleGoalReached}
          onToggle={handleToggleGoalBanner}
        />
      )}
      {rollup && !showGoalBanner && (
        <div className="w-full bg-gray-200 border-b border-gray-300 px-4 py-2">
          <div className="max-w-6xl mx-auto flex justify-end">
            <button
              onClick={handleToggleGoalBanner}
              className="text-xs md:text-sm text-gray-600 hover:text-gray-800 font-medium underline transition-colors"
              title="Show goal banner"
            >
              Show Goal
            </button>
          </div>
        </div>
      )}
      <div className={contentClass}>
        <div className="flex justify-between items-center mb-4 md:mb-8 lg:mb-10 gap-2">
          <div className="flex items-center gap-1 md:gap-3 lg:gap-4">
            <img 
              src={ninjaLogo} 
              alt="Earnings Ninja" 
              className="h-20 md:h-32 lg:h-40 w-auto drop-shadow-lg"
              style={{
                filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.6))',
              }}
            />
          </div>
          <div className="flex gap-1 md:gap-2">
            <button
              onClick={() => onNavigateToLeaderboard?.()}
              className={`relative p-2 md:p-2.5 rounded-lg transition-all ${
                isDarkTheme
                  ? 'hover:bg-cyan-500/20 text-cyan-400'
                  : 'hover:bg-blue-100 text-blue-600'
              }`}
              title="View leaderboard"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                🏆
              </span>
            </button>
            <button
              onClick={() => setResetConfirm(true)}
              className={`px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg font-bold whitespace-nowrap shadow-lg transition-all ${
                isDarkTheme
                  ? 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 hover:shadow-red-500/50'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
              title="Reset today's data"
            >
              Reset
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-2 md:p-2.5 transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : config.textPrimary + ' hover:opacity-80'}`}
              title="Refresh data"
            >
              <svg 
                className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 md:p-2.5 transition-colors ${config.textPrimary} hover:opacity-80`}
              data-tour="settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mb-4 md:mb-8 lg:mb-10 overflow-x-auto" data-tour="periods">
          <PeriodChips selected={period} onSelect={setPeriod} />
        </div>

        <div className="mb-4 md:mb-8 lg:mb-10" data-tour="search">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
            isDarkTheme
              ? 'bg-slate-800 border-slate-700 focus-within:border-cyan-400'
              : 'bg-white border-gray-300 focus-within:border-blue-500'
          }`}>
            <svg className={`w-5 h-5 ${isDarkTheme ? 'text-slate-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`flex-1 bg-transparent outline-none text-sm ${isDarkTheme ? 'text-white placeholder-slate-400' : 'text-gray-900 placeholder-gray-400'}`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`text-sm font-medium ${isDarkTheme ? 'text-slate-400 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Negative Profit Alert */}
        {rollup && rollup.profit < 0 && showNegativeAlert && (
          <div className={`mb-4 md:mb-8 lg:mb-10 p-4 md:p-6 lg:p-8 rounded-xl border-2 transition-all ${
            isDarkTheme
              ? 'bg-gradient-to-r from-red-900/40 to-red-800/30 border-red-600/60 shadow-lg shadow-red-900/30'
              : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-300 shadow-md shadow-red-200/50'
          }`}>
            <div className="flex items-center gap-4">
              <div className="text-4xl md:text-5xl flex-shrink-0 animate-pulse">⚠️</div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-lg md:text-xl font-bold mb-1 ${isDarkTheme ? 'text-red-300' : 'text-red-700'}`}>
                  You're in the Negative!
                </h3>
                <p className={`text-sm md:text-base ${isDarkTheme ? 'text-red-200/90' : 'text-red-600/90'}`}>
                  You need to make <span className="font-black text-lg md:text-2xl">${Math.abs(rollup.profit).toFixed(2)}</span> to get back into profit {period === 'today' ? 'today' : period === 'yesterday' ? 'yesterday' : period === 'week' ? 'this week' : period === 'last7' ? 'in the last 7 days' : period === 'month' ? 'this month' : period === 'lastMonth' ? 'last month' : 'this period'}
                </p>
              </div>
              <button
                onClick={() => setShowNegativeAlert(false)}
                className={`flex-shrink-0 p-2 rounded-lg transition-all ${
                  isDarkTheme
                    ? 'hover:bg-red-600/30 text-red-300 hover:text-red-200'
                    : 'hover:bg-red-200 text-red-700 hover:text-red-900'
                }`}
                title="Dismiss alert"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Dashboard Grid - Everything in One View */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8 lg:gap-10 mb-4 md:mb-8 lg:mb-10">
          {/* Left Column - Performance Overview */}
          <div className="lg:col-span-3 space-y-6 md:space-y-8 lg:space-y-10 scroll-smooth" data-tour="performance">
            {/* Performance Overview Header with Toggle */}
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-bold ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>
                Performance Overview
              </h2>
              <button
                onClick={() => setShowPerformanceOverview(!showPerformanceOverview)}
                className={`p-2 rounded-lg transition-all ${
                  isDarkTheme
                    ? 'text-slate-400 hover:text-cyan-300 hover:bg-slate-700/50'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-200'
                }`}
                title={showPerformanceOverview ? 'Collapse' : 'Expand'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPerformanceOverview ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  )}
                </svg>
              </button>
            </div>

            {showPerformanceOverview && (
              <>
                <SummaryCard
                  revenue={`$${rollup?.revenue.toFixed(2) || '0.00'}`}
                  expenses={`$${rollup?.expenses.toFixed(2) || '0.00'}`}
                  profit={`$${rollup?.profit.toFixed(2) || '0.00'}`}
                  miles={rollup?.miles.toFixed(1) || '0.0'}
                  orders={entries.filter(e => e.type === 'ORDER').length}
                  margin={rollup?.revenue ? `${(((rollup.profit || 0) / rollup.revenue) * 100).toFixed(0)}%` : '-'}
                  avgOrder={`$${rollup?.average_order_value.toFixed(2) || '0.00'}`}
                  dayOffset={dayOffset}
                  onDayChange={(offset) => {
                    setDayOffset(offset);
                    if (period !== 'today') {
                      setPeriod('today');
                    }
                  }}
                  getDateLabel={getDateLabel}
                  isDarkTheme={isDarkTheme}
                  showDayNav={period === 'today'}
                  periodLabel={getPeriodLabel()}
                  visibilityConfig={metricVisibility}
                  onShare={() => setShowShareCard(true)}
                />

                {/* Profit Calendar Toggle and Display */}
                {!isSimple && (
                  <>
                    <div className="w-full px-2 md:px-0">
                      <button
                        onClick={() => setShowCalendar(!showCalendar)}
                        className={`w-full px-6 py-4 md:py-5 rounded-xl md:rounded-2xl font-bold text-lg md:text-xl transition-all flex items-center justify-center gap-3 transform hover:scale-105 active:scale-95 duration-200 shadow-lg hover:shadow-2xl ${
                          isDarkTheme
                            ? showCalendar
                              ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-white border-2 border-cyan-300 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50'
                              : 'bg-gradient-to-r from-slate-700 to-slate-800 text-cyan-300 border-2 border-cyan-500/50 hover:from-slate-600 hover:to-slate-700 hover:text-cyan-200 hover:border-cyan-400'
                            : showCalendar
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-2 border-blue-400 hover:from-blue-600 hover:to-blue-700'
                            : 'bg-gradient-to-r from-blue-400 to-indigo-500 text-white border-2 border-blue-300 hover:from-blue-500 hover:to-indigo-600 hover:border-blue-400'
                        }`}
                      >
                        <span className="text-2xl md:text-3xl">{showCalendar ? '📆' : '📅'}</span>
                        <span>{showCalendar ? 'Hide Calendar' : 'Show Calendar'}</span>
                        <span className={`ml-2 transition-transform ${showCalendar ? 'rotate-180' : ''}`}>↓</span>
                      </button>
                    </div>

                    {showCalendar && (
                      <div>
                        <ProfitCalendar entries={monthlyEntries} />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Right Column - Quick Stats & Achievements */}
          <div className="lg:col-span-1 space-y-6 md:space-y-8 lg:space-y-10">
            <PotOfGoldTracker />
            
            <div className="grid grid-cols-2 gap-4 md:gap-6">
              <KpiCard
                title="$/Mile"
                value={`$${rollup?.dollars_per_mile.toFixed(2) || '0.00'}`}
                detail1={{ label: 'Efficiency', value: rollup?.miles ? `${(rollup.revenue / rollup.miles).toFixed(2)}/mi` : '-' }}
                color="orange"
              />
              <KpiCard
                title="$/Hour"
                value={`$${rollup?.dollars_per_hour.toFixed(2) || '0.00'}`}
                detail1={{ label: 'Hours', value: rollup ? `${(rollup.by_type?.total_minutes / 60 || 0).toFixed(1)}h` : '-' }}
                color="gray"
              />
            </div>

          </div>
        </div>


        {/* Achievements Modal */}
        {!isSimple && showAchievementsModal && (
          <AchievementsModal 
            entries={entries} 
            rollup={rollup} 
            monthlyGoal={monthlyGoal}
            onClose={() => setShowAchievementsModal(false)}
          />
        )}

        {!isSimple && (
          <div>
            {/* Calculate date range for AI suggestions based on current period */}
            {(() => {
              let fromDate = '';
              let toDate = '';
              
              const now = new Date();
              const startOfDay = (date: Date) => {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                return d;
              };
              const endOfDay = (date: Date) => {
                const d = new Date(date);
                d.setHours(23, 59, 59, 999);
                return d;
              };
              
              if (period === 'today' || period === 'yesterday') {
                const offset = period === 'today' ? dayOffset : -1;
                const targetDay = new Date(now);
                targetDay.setDate(targetDay.getDate() + offset);
                fromDate = startOfDay(targetDay).toISOString();
                toDate = endOfDay(targetDay).toISOString();
              } else if (period === 'week') {
                const weekStart = new Date(now);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                fromDate = startOfDay(weekStart).toISOString();
                toDate = endOfDay(now).toISOString();
              } else if (period === 'last7') {
                const last7 = new Date(now);
                last7.setDate(last7.getDate() - 6);
                fromDate = startOfDay(last7).toISOString();
                toDate = endOfDay(now).toISOString();
              } else if (period === 'month') {
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                fromDate = startOfDay(monthStart).toISOString();
                toDate = endOfDay(now).toISOString();
              } else if (period === 'lastMonth') {
                const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                fromDate = startOfDay(lastMonthStart).toISOString();
                toDate = endOfDay(lastMonthEnd).toISOString();
              } else {
                fromDate = startOfDay(now).toISOString();
                toDate = endOfDay(now).toISOString();
              }
              
              return <AISuggestions fromDate={fromDate} toDate={toDate} />;
            })()}
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
            <span className="text-blue-900 font-medium">
              {selectedIds.length} {selectedIds.length === 1 ? 'entry' : 'entries'} selected
            </span>
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              disabled={bulkDeleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium disabled:bg-gray-400"
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        )}

        <div className="mb-6" data-tour="entries">
          <EntriesTable 
            entries={filteredEntries} 
            onDelete={handleDelete}
            onEdit={handleEditEntry}
            onView={setViewingEntry}
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
          />
        </div>
      </div>

      <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl transition-transform duration-300 z-50 ${calcExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-4rem)]'}`} data-tour="calculator">
        <button
          onClick={() => setCalcExpanded(!calcExpanded)}
          className="w-full py-4 px-4 flex items-center justify-between bg-gradient-to-r from-lime-500 to-green-700 text-white font-bold text-lg hover:from-lime-600 hover:to-green-800 opacity-100 shadow-lg"
        >
          <span>{calcExpanded ? '▼ Hide Calculator' : '+ Add Entry'}</span>
          <span className="text-sm font-semibold">{amount !== '0' ? `$${amount}` : ''}</span>
        </button>
        
        <div className="max-w-6xl mx-auto p-4 max-h-[70vh] overflow-y-auto">
          {/* Step 0: Calculator Only */}
          {entryFormStep === 0 && (
            <>
              <div className="mb-4">
                <CalcPad
                  amount={amount}
                  mode={mode}
                  onAmountChange={setAmount}
                  onModeChange={handleModeChange}
                />
              </div>
              <button
                onClick={() => setEntryFormStep(1)}
                className="w-full bg-lime-500 hover:bg-lime-600 text-white py-4 rounded-lg text-lg font-bold mb-6"
              >
                Next Step →
              </button>
            </>
          )}

          {/* Step 1: All Form Fields */}
          {entryFormStep === 1 && (
            <>
              <EntryForm 
                mode={mode} 
                onTypeChange={setEntryType} 
                formData={formData}
                onFormDataChange={setFormData}
                period={period}
                dayOffset={dayOffset}
                showExtraInfo={true}
              />
              <div className="flex gap-3 mt-4 mb-6">
                <button
                  onClick={() => setEntryFormStep(0)}
                  className="flex-1 bg-gray-400 hover:bg-gray-500 text-white py-4 rounded-lg text-lg font-bold"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={createMutation.isPending}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-lg text-lg font-bold disabled:bg-gray-400"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {editingEntry && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={handleCancelEdit} />
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Edit Entry</h2>
              <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📝 Notes (optional)</label>
                <textarea
                  value={editingFormData.note}
                  onChange={(e) => setEditingFormData({ ...editingFormData, note: e.target.value })}
                  placeholder="Add notes about this entry..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={3}
                />
              </div>

              <EntryForm
                mode={editingFormData.type === 'EXPENSE' ? 'subtract' : 'add'}
                onTypeChange={(type) => setEditingFormData({ ...editingFormData, type })}
                formData={editingFormData}
                onFormDataChange={setEditingFormData}
                period={period}
                dayOffset={dayOffset}
                isEditing={true}
              />
            </div>

            <div className="space-y-2">
              <button
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
                className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-400"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancelEdit}
                className="w-full bg-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {settings && (
        <SettingsDrawer
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onSave={(s) => updateSettingsMutation.mutate(s)}
          onResetAll={() => setResetAllConfirm(true)}
          onExport={() => handleExport()}
          onRestartTour={handleRestartTour}
          onLogout={logout}
          metricVisibility={metricVisibility}
          onMetricVisibilityChange={handleMetricVisibilityChange}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Entry"
          message="Are you sure you want to delete this entry? This action cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {bulkDeleteConfirm && (
        <ConfirmDialog
          title="Delete Selected Entries"
          message={`Are you sure you want to delete ${selectedIds.length} ${selectedIds.length === 1 ? 'entry' : 'entries'}? This action cannot be undone.`}
          onConfirm={confirmBulkDelete}
          onCancel={() => setBulkDeleteConfirm(false)}
        />
      )}

      {resetConfirm && (
        <ConfirmDialog
          title="Reset Today's Data"
          message="This will delete all entries from today and cannot be undone. Previous days' data will remain intact."
          onConfirm={confirmReset}
          onCancel={() => setResetConfirm(false)}
          confirmText="Reset"
          cancelText="Cancel"
        />
      )}

      {resetAllConfirm && (
        <ConfirmDialog
          title="Reset All Data"
          message="This will permanently delete ALL entries from your dashboard. This action cannot be undone."
          onConfirm={confirmResetAll}
          onCancel={() => setResetAllConfirm(false)}
          confirmText="Delete All"
          cancelText="Cancel"
        />
      )}

      {viewingEntry && (
        <EntryViewer
          entry={viewingEntry}
          onClose={() => setViewingEntry(null)}
        />
      )}

      {!isSimple && showShareCard && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setShowShareCard(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Share Your Performance</h2>
                <button
                  onClick={() => setShowShareCard(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ShareCard
                revenue={`${rollup?.revenue.toFixed(2) || '0.00'}`}
                expenses={`${rollup?.expenses.toFixed(2) || '0.00'}`}
                profit={`${rollup?.profit.toFixed(2) || '0.00'}`}
                miles={`${rollup?.miles.toFixed(1) || '0.0'}`}
                orders={entries.filter(e => e.type === 'ORDER').length}
                avgOrder={`${rollup?.average_order_value.toFixed(2) || '0.00'}`}
                periodLabel={getPeriodLabel()}
              />
            </div>
          </div>
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Feature Tour - Interactive tour guide */}
      {showFeatureTour && <FeatureTour onClose={handleCloseTour} />}
    </div>
  );
}
