import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, EntryCreate, EntryType, TimeframeType } from '../lib/api';
import { PeriodChips, Period } from '../components/PeriodChips';
import { KpiCard } from '../components/KpiCard';
import { SummaryCard } from '../components/SummaryCard';
import { CalcPad, CalcMode } from '../components/CalcPad';
import { EntryForm, EntryFormData } from '../components/EntryForm';
import { EntriesTable } from '../components/EntriesTable';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import { ProfitGoalsBar } from '../components/ProfitGoalsBar';
import { AISuggestions } from '../components/AISuggestions';
import { EntryViewer } from '../components/EntryViewer';
import { useTheme } from '../lib/themeContext';

function getPeriodDates(period: Period): { from: string; to: string } {
  const now = new Date();
  
  const startOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  
  const endOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  switch (period) {
    case 'today':
      return {
        from: startOfDay(now).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        from: startOfDay(yesterday).toISOString(),
        to: endOfDay(yesterday).toISOString(),
      };
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return {
        from: weekStart.toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case 'last7':
      const last7 = new Date(now);
      last7.setDate(last7.getDate() - 6);
      last7.setHours(0, 0, 0, 0);
      return {
        from: last7.toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case 'month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      return {
        from: monthStart.toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case 'lastMonth':
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      lastMonthStart.setHours(0, 0, 0, 0);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      lastMonthEnd.setHours(23, 59, 59, 999);
      return {
        from: lastMonthStart.toISOString(),
        to: lastMonthEnd.toISOString(),
      };
    default:
      return {
        from: startOfDay(now).toISOString(),
        to: now.toISOString(),
      };
  }
}

export function Dashboard() {
  const [period, setPeriod] = useState<Period>('today');
  const [amount, setAmount] = useState('0');
  const [mode, setMode] = useState<CalcMode>('add');
  const [, setEntryType] = useState<EntryType>('ORDER');
  const [formData, setFormData] = useState<EntryFormData>({
    type: 'ORDER',
    app: 'UBEREATS',
    distance_miles: '',
    category: 'GAS',
    note: '',
    receipt_url: undefined,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetAllConfirm, setResetAllConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [calcExpanded, setCalcExpanded] = useState(false);
  const [editingEntry, setEditingEntry] = useState<api.Entry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<api.Entry | null>(null);
  const [editingFormData, setEditingFormData] = useState<EntryFormData>({
    type: 'ORDER',
    app: 'UBEREATS',
    distance_miles: '',
    category: 'GAS',
    note: '',
    receipt_url: undefined,
  });
  const [showGoalBanner, setShowGoalBanner] = useState(() => {
    const saved = localStorage.getItem('showGoalBanner');
    return saved === null ? true : saved === 'true';
  });

  const queryClient = useQueryClient();
  const dates = getPeriodDates(period);

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

  useEffect(() => {
    setSelectedIds([]);
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
    };
    return mapping[p] || 'TODAY';
  };

  const { data: rollup } = useQuery({
    queryKey: ['rollup', dates.from, dates.to, period],
    queryFn: () => api.getRollup(dates.from, dates.to, getTimeframe(period)),
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['entries', dates.from, dates.to],
    queryFn: () => api.getEntries(dates.from, dates.to),
  });

  const createMutation = useMutation({
    mutationFn: api.createEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
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
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
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
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
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
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
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
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
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
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
      setResetAllConfirm(false);
      setToast({ message: 'All data has been reset!', type: 'success' });
    },
    onError: () => {
      setToast({ message: 'Failed to reset all data', type: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; entry: api.EntryCreate }) =>
      api.updateEntry(data.id, data.entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['rollup'] });
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
      return;
    }

    const finalAmount = Math.abs(amountNum);

    const entry: EntryCreate = {
      timestamp: new Date().toISOString(),
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
    // When switching to subtract, automatically change type to EXPENSE
    if (newMode === 'subtract') {
      setFormData(prev => ({
        ...prev,
        type: 'EXPENSE',
        app: 'OTHER', // Set app to OTHER for expenses
      }));
      setEntryType('EXPENSE');
    }
  };

  const handleEditEntry = (entry: api.Entry) => {
    setEditingEntry(entry);
    setEditingFormData({
      type: entry.type,
      app: entry.app,
      distance_miles: entry.distance_miles.toString(),
      category: entry.category as any || 'GAS',
      note: entry.note || '',
      receipt_url: entry.receipt_url,
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

    const entry: api.EntryCreate = {
      timestamp: editingEntry.timestamp,
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
  };

  const handleToggleGoalBanner = () => {
    setShowGoalBanner(prev => {
      const newValue = !prev;
      localStorage.setItem('showGoalBanner', newValue.toString());
      return newValue;
    });
  };

  const { config } = useTheme();
  const isDarkTheme = config.name !== 'simple-light';

  const dashboardClass = config.name === 'simple-light' 
    ? 'min-h-screen bg-gradient-to-b from-gray-50 via-gray-100 to-white flex flex-col'
    : config.name === 'bw-neon'
    ? 'min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex flex-col'
    : 'min-h-screen bg-gradient-to-b from-gray-950 via-slate-900 to-gray-950 flex flex-col';

  const contentClass = config.name === 'simple-light'
    ? 'flex-1 overflow-y-auto max-w-6xl mx-auto px-3 md:px-4 py-3 md:py-6 pb-24 w-full bg-gradient-to-b from-gray-50 via-gray-100 to-white'
    : config.name === 'bw-neon'
    ? 'flex-1 overflow-y-auto max-w-6xl mx-auto px-3 md:px-4 py-3 md:py-6 pb-24 w-full bg-gradient-to-b from-black via-gray-900 to-black'
    : 'flex-1 overflow-y-auto max-w-6xl mx-auto px-3 md:px-4 py-3 md:py-6 pb-24 w-full bg-gradient-to-b from-gray-950 via-slate-900 to-gray-950';

  return (
    <div className={dashboardClass}>
      {rollup && showGoalBanner && (
        <ProfitGoalsBar
          timeframe={getTimeframeFromPeriod(period)}
          currentProfit={rollup.profit}
          goalProgress={rollup.goal_progress}
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
        <div className="flex justify-between items-center mb-3 md:mb-6 gap-2">
          <div className="flex items-center gap-3">
            <span className="text-5xl md:text-6xl drop-shadow-lg" style={{
              textShadow: isDarkTheme ? '0 0 20px rgba(34, 211, 238, 0.8), 0 0 40px rgba(59, 130, 246, 0.5)' : 'none',
              filter: isDarkTheme ? 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.6))' : 'none',
              animation: 'car-drive 2s ease-in-out infinite'
            }}>
              🚗
            </span>
            <h1 className={`text-3xl md:text-5xl font-black ${config.titleColor}`}>EARNINGS</h1>
          </div>
          <div className="flex gap-1 md:gap-2">
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
              onClick={() => setShowSettings(true)}
              className={`p-2 md:p-2.5 transition-colors ${config.textPrimary} hover:opacity-80`}
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

        <div className="mb-3 md:mb-6 overflow-x-auto">
          <PeriodChips selected={period} onSelect={setPeriod} />
        </div>

        <SummaryCard
          revenue={`$${rollup?.revenue.toFixed(2) || '0.00'}`}
          expenses={`$${rollup?.expenses.toFixed(2) || '0.00'}`}
          profit={`$${rollup?.profit.toFixed(2) || '0.00'}`}
          miles={rollup?.miles.toFixed(1) || '0.0'}
          orders={entries.filter(e => e.type === 'ORDER').length}
          margin={rollup?.revenue ? `${(((rollup.profit || 0) / rollup.revenue) * 100).toFixed(0)}%` : '-'}
          avgOrder={`$${rollup?.average_order_value.toFixed(2) || '0.00'}`}
        />

        <div className="mb-4 md:mb-6 overflow-x-auto scroll-smooth">
          <div className="flex gap-3 md:gap-4 pb-2 min-w-max">
            <div className="flex-shrink-0 w-80">
              <KpiCard
                title="Revenue"
                value={`$${rollup?.revenue.toFixed(2) || '0.00'}`}
                detail1={{ label: 'Orders', value: entries.filter(e => e.type === 'ORDER').length }}
                color="green"
              />
            </div>
            <div className="flex-shrink-0 w-80">
              <KpiCard
                title="Expenses"
                value={`$${rollup?.expenses.toFixed(2) || '0.00'}`}
                detail1={{ label: 'Count', value: entries.filter(e => e.type === 'EXPENSE').length }}
                color="red"
              />
            </div>
            <div className="flex-shrink-0 w-80">
              <KpiCard
                title="Profit"
                value={`$${rollup?.profit.toFixed(2) || '0.00'}`}
                detail1={{ label: 'Margin', value: rollup?.revenue ? `${(((rollup.profit || 0) / rollup.revenue) * 100).toFixed(0)}%` : '-' }}
                color="green"
              />
            </div>
            <div className="flex-shrink-0 w-80">
              <KpiCard
                title="Miles"
                value={rollup?.miles.toFixed(1) || '0.0'}
                detail1={{ label: 'Trips', value: entries.filter(e => e.distance_miles > 0).length }}
                color="purple"
              />
            </div>
            <div className="flex-shrink-0 w-80">
              <KpiCard
                title="$/Mile"
                value={`$${rollup?.dollars_per_mile.toFixed(2) || '0.00'}`}
                detail1={{ label: 'Efficiency', value: rollup?.miles ? `${(rollup.revenue / rollup.miles).toFixed(2)}/mile` : '-' }}
                color="orange"
              />
            </div>
            <div className="flex-shrink-0 w-80">
              <KpiCard
                title="$/Hour"
                value={`$${rollup?.dollars_per_hour.toFixed(2) || '0.00'}`}
                detail1={{ label: 'Hours', value: rollup ? `${(rollup.by_type?.total_minutes / 60 || 0).toFixed(1)}h` : '-' }}
                color="gray"
              />
            </div>
            <div className="flex-shrink-0 w-80">
              <KpiCard
                title="Avg Order"
                value={`$${rollup?.average_order_value.toFixed(2) || '0.00'}`}
                detail1={{ label: 'Orders', value: entries.filter(e => e.type === 'ORDER').length }}
                color="blue"
              />
            </div>
          </div>
        </div>

        <div>
          <AISuggestions fromDate={getPeriodDates(period).from} toDate={getPeriodDates(period).to} />
        </div>

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

        <div className="mb-6">
          <EntriesTable 
            entries={entries} 
            onDelete={handleDelete}
            onEdit={handleEditEntry}
            onView={setViewingEntry}
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
          />
        </div>
      </div>

      <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl transition-transform duration-300 z-50 ${calcExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-4rem)]'}`}>
        <button
          onClick={() => setCalcExpanded(!calcExpanded)}
          className="w-full py-4 px-4 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-lg hover:from-blue-700 hover:to-blue-600 opacity-100 shadow-lg"
        >
          <span>{calcExpanded ? '▼ Hide Calculator' : '+ Add Entry'}</span>
          <span className="text-sm font-semibold">{amount !== '0' ? `$${amount}` : ''}</span>
        </button>
        
        <div className="max-w-6xl mx-auto p-4 max-h-[70vh] overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <CalcPad
              amount={amount}
              mode={mode}
              onAmountChange={setAmount}
              onModeChange={handleModeChange}
            />
            <EntryForm 
              mode={mode} 
              onTypeChange={setEntryType} 
              formData={formData}
              onFormDataChange={setFormData}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={createMutation.isPending}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-lg text-lg font-bold disabled:bg-gray-400 mb-6"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Entry'}
          </button>
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

              <EntryForm
                mode={editingFormData.type === 'EXPENSE' ? 'subtract' : 'add'}
                onTypeChange={(type) => setEditingFormData({ ...editingFormData, type })}
                formData={editingFormData}
                onFormDataChange={setEditingFormData}
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
