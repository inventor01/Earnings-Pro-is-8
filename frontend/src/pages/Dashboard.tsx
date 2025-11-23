import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, EntryCreate, EntryType, TimeframeType } from '../lib/api';
import { PeriodChips, Period } from '../components/PeriodChips';
import { KpiCard } from '../components/KpiCard';
import { CalcPad, CalcMode } from '../components/CalcPad';
import { EntryForm, EntryFormData } from '../components/EntryForm';
import { EntriesTable } from '../components/EntriesTable';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '../components/Toast';
import { TripTracker } from '../components/TripTracker';
import { ProfitGoalsBar } from '../components/ProfitGoalsBar';

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
    duration_minutes: '',
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
      duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : 0,
      category: (formData.type === 'EXPENSE' && formData.category) ? formData.category : undefined,
      note: formData.note || undefined,
      receipt_url: formData.receipt_url || undefined,
    };

    createMutation.mutate(entry);
    
    setFormData({
      type: formData.type,
      app: formData.app,
      distance_miles: '',
      duration_minutes: '',
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

  const handleTripComplete = (miles: number, durationMinutes: number) => {
    setFormData({
      ...formData,
      distance_miles: miles.toString(),
      duration_minutes: durationMinutes.toString(),
      type: 'ORDER',
    });
    setCalcExpanded(true);
    setToast({ message: `Trip completed! ${miles} miles tracked`, type: 'success' });
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {rollup && (
        <ProfitGoalsBar
          timeframe={getTimeframeFromPeriod(period)}
          currentProfit={rollup.profit}
          goalProgress={rollup.goal_progress}
        />
      )}
      <div className="flex-1 overflow-y-auto max-w-6xl mx-auto px-4 py-6 pb-24 w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Driver Earnings</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setResetConfirm(true)}
              className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium"
              title="Reset today's data"
            >
              Reset Today
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-600 hover:text-gray-900"
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

        <div className="mb-6">
          <PeriodChips selected={period} onSelect={setPeriod} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <KpiCard
            title="Revenue"
            value={`$${rollup?.revenue.toFixed(2) || '0.00'}`}
            color="green"
          />
          <KpiCard
            title="Expenses"
            value={`$${rollup?.expenses.toFixed(2) || '0.00'}`}
            color="red"
          />
          <KpiCard
            title="Profit"
            value={`$${rollup?.profit.toFixed(2) || '0.00'}`}
            color="blue"
          />
          <KpiCard
            title="Miles"
            value={rollup?.miles.toFixed(1) || '0.0'}
            color="purple"
          />
          <KpiCard
            title="$/Mile"
            value={`$${rollup?.dollars_per_mile.toFixed(2) || '0.00'}`}
            color="orange"
          />
          <KpiCard
            title="$/Hour"
            value={`$${rollup?.dollars_per_hour.toFixed(2) || '0.00'}`}
            color="gray"
          />
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
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
          />
        </div>
      </div>

      <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl transition-transform duration-300 ${calcExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-4rem)]'}`}>
        <button
          onClick={() => setCalcExpanded(!calcExpanded)}
          className="w-full py-4 px-4 flex items-center justify-between bg-blue-500 text-white font-bold text-lg hover:bg-blue-600"
        >
          <span>{calcExpanded ? '▼ Hide Calculator' : '+ Add Entry'}</span>
          <span className="text-sm opacity-90">{amount !== '0' ? `$${amount}` : ''}</span>
        </button>
        
        <div className="max-w-6xl mx-auto p-4 max-h-[70vh] overflow-y-auto">
          <div className="mb-4">
            <TripTracker onTripComplete={handleTripComplete} />
          </div>
          
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <CalcPad
              amount={amount}
              mode={mode}
              onAmountChange={setAmount}
              onModeChange={setMode}
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
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-lg text-lg font-bold disabled:bg-gray-400"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>

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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
