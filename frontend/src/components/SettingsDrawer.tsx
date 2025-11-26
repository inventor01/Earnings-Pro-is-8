import { Settings } from '../lib/api';
import { useTheme } from '../lib/themeContext';
import { getAllThemes, ThemeName } from '../lib/themes';
import { MetricVisibility } from './SummaryCard';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onResetAll?: () => void;
  onExport?: () => void;
  onRestartTour?: () => void;
  metricVisibility?: Partial<MetricVisibility>;
  onMetricVisibilityChange?: (visibility: Partial<MetricVisibility>) => void;
}

export function SettingsDrawer({ isOpen, onClose, onResetAll, onExport, onRestartTour, metricVisibility = {}, onMetricVisibilityChange }: SettingsDrawerProps) {
  const { theme, setTheme, config } = useTheme();

  if (!isOpen) return null;

  const handleResetAll = () => {
    onResetAll?.();
    onClose();
  };

  const handleMetricToggle = (metric: keyof MetricVisibility) => {
    const newVisibility = {
      ...metricVisibility,
      [metric]: !(metricVisibility[metric] !== false)
    };
    onMetricVisibilityChange?.(newVisibility);
  };

  const isDark = config.name !== 'simple-light';

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      <div className={`fixed right-0 top-0 h-full w-80 shadow-xl z-50 flex flex-col ${
        isDark 
          ? 'bg-slate-900 text-slate-100 border-l border-slate-700' 
          : 'bg-white text-gray-900 border-l border-gray-200'
      }`}>
        <div className={`flex justify-between items-center mb-6 p-6 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'} flex-shrink-0`}>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
          <button onClick={onClose} className={isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
              Theme
            </label>
            <div className="space-y-2">
              {getAllThemes().map((t) => (
                <button
                  key={t.name}
                  onClick={() => setTheme(t.name as ThemeName)}
                  className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    theme === t.name
                      ? isDark
                        ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-300'
                        : 'bg-blue-100 border border-blue-500 text-blue-700'
                      : isDark
                      ? 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-500'
                      : 'bg-gray-100 border border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`py-6 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <h3 className={`text-sm font-medium mb-4 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Performance Overview Metrics</h3>
            <div className="space-y-3">
              {[
                { key: 'revenue' as const, label: '💰 Revenue' },
                { key: 'expenses' as const, label: '💸 Expenses' },
                { key: 'profit' as const, label: '🎯 Profit' },
                { key: 'miles' as const, label: '🛣️ Miles' },
                { key: 'orders' as const, label: '📦 Orders' },
                { key: 'avgOrder' as const, label: '📊 Avg Order' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleMetricToggle(key)}
                  className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all text-left flex items-center gap-3 ${
                    metricVisibility[key] !== false
                      ? isDark
                        ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300'
                        : 'bg-blue-100 border border-blue-500 text-blue-700'
                      : isDark
                      ? 'bg-slate-800 border border-slate-700 text-slate-400 opacity-50'
                      : 'bg-gray-100 border border-gray-300 text-gray-500 opacity-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={metricVisibility[key] !== false}
                    onChange={() => {}}
                    className="w-4 h-4 cursor-pointer"
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`border-t ${isDark ? 'border-slate-700' : 'border-gray-200'} p-6 flex-shrink-0 space-y-4`}>
          <div>
            <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Help & Tutorial</h3>
            <button
              onClick={() => {
                onRestartTour?.();
                onClose();
              }}
              className={`w-full py-3 rounded-lg font-medium transition-all ${
                isDark
                  ? 'bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500 text-indigo-400'
                  : 'bg-indigo-500 hover:bg-indigo-600 text-white'
              }`}
            >
              🎓 Restart Tour
            </button>
            <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              See the interactive tour again to learn all features.
            </p>
          </div>

          <div>
            <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Export</h3>
            <button
              onClick={onExport}
              className={`w-full py-3 rounded-lg font-medium transition-all ${
                isDark
                  ? 'bg-cyan-900/30 hover:bg-cyan-900/50 border border-cyan-500 text-cyan-400'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              📥 Export to CSV
            </button>
            <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              Download all entries as a CSV file.
            </p>
          </div>

          <div>
            <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Danger Zone</h3>
            <button
              onClick={handleResetAll}
              className={`w-full py-3 rounded-lg font-medium transition-all ${
                isDark
                  ? 'bg-red-900/30 hover:bg-red-900/50 border border-red-500 text-red-400'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              🗑️ Reset All Data
            </button>
            <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              Permanently delete all entries. This action cannot be undone.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
