import { Settings } from '../lib/api';
import { useTheme } from '../lib/themeContext';
import { MetricVisibility } from './SummaryCard';
import { Icons } from './Icons';
import { useQuery } from '@tanstack/react-query';
import { useSimpleMode } from '../lib/simpleModeContext';

interface UserInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_image_url?: string;
}

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onResetAll?: () => void;
  onExport?: () => void;
  onRestartTour?: () => void;
  onLogout?: () => void;
  metricVisibility?: Partial<MetricVisibility>;
  onMetricVisibilityChange?: (visibility: Partial<MetricVisibility>) => void;
}

export function SettingsDrawer({ isOpen, onClose, onResetAll, onExport, onRestartTour, onLogout, metricVisibility = {}, onMetricVisibilityChange }: SettingsDrawerProps) {
  const { config } = useTheme();
  const { isSimple, setIsSimple } = useSimpleMode();
  const { data: userInfo } = useQuery<UserInfo>({
    queryKey: ['userInfo'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      if (!token || token === 'guest-token') return null;
      const res = await fetch(`/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

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

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full md:w-80 shadow-xl z-50 flex flex-col bg-white text-gray-900 border-l-2 border-lime-500">
        <div className="flex justify-between items-center mb-6 p-6 border-b border-lime-400 flex-shrink-0">
          <h2 className="text-xl font-bold text-green-800 flex items-center gap-2">
            <Icons.Settings width={24} height={24} className="text-lime-600" />
            Settings
          </h2>
          <button onClick={onClose} className="text-green-700 hover:text-green-900 w-6 h-6">
            <Icons.X width="100%" height="100%" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          {userInfo && (
            <div className="mb-6 p-4 rounded-lg bg-lime-50 border-2 border-lime-400">
              <h3 className="text-sm font-medium mb-3 text-green-800 flex items-center gap-2">
                <Icons.User width={16} height={16} className="text-green-800" />
                Account Information
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-green-700">Username</p>
                  <p className="font-semibold text-gray-900">{userInfo.first_name}</p>
                </div>
                <div>
                  <p className="text-green-700">Email</p>
                  <p className="font-semibold break-all text-gray-900">{userInfo.email}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-green-800">
              View Mode
            </label>
            <button
              onClick={() => setIsSimple(!isSimple)}
              className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all mb-3 border-2 ${
                isSimple
                  ? 'bg-lime-500 border-lime-600 text-white'
                  : 'bg-lime-100 border-lime-400 text-green-900 hover:bg-lime-200'
              }`}
            >
              {isSimple ? '✓ Simple Mode' : '◯ Simple Mode'}
            </button>
          </div>

          <div className="py-6 border-t border-lime-400">
            <h3 className="text-sm font-medium mb-4 text-green-800">Performance Overview Metrics</h3>
            <div className="space-y-3">
              {[
                { key: 'revenue' as const, label: 'Revenue', icon: Icons.Revenue },
                { key: 'expenses' as const, label: 'Expenses', icon: Icons.Expenses },
                { key: 'profit' as const, label: 'Profit', icon: Icons.Profit },
                { key: 'miles' as const, label: 'Miles', icon: Icons.Miles },
                { key: 'orders' as const, label: 'Orders', icon: Icons.Orders },
                { key: 'avgOrder' as const, label: 'Avg Order', icon: Icons.AvgOrder },
              ].map(({ key, label, icon: IconComponent }) => (
                <button
                  key={key}
                  onClick={() => handleMetricToggle(key)}
                  className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all text-left flex items-center gap-3 border-2 ${
                    metricVisibility[key] !== false
                      ? 'bg-lime-200 border-lime-500 text-green-900'
                      : 'bg-gray-100 border-gray-300 text-gray-500 opacity-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={metricVisibility[key] !== false}
                    onChange={() => {}}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <IconComponent width={16} height={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-lime-400 p-4 flex-shrink-0 space-y-2">
          <div>
            <h3 className="text-xs font-medium mb-1 text-green-800 flex items-center gap-1">
              <Icons.HelpCircle width={14} height={14} />
              Help & Tutorial
            </h3>
            <button
              onClick={() => {
                onRestartTour?.();
                onClose();
              }}
              className="w-full py-1.5 px-3 rounded text-sm font-medium transition-all bg-yellow-500 hover:bg-yellow-600 text-white border-2 border-yellow-600 flex items-center justify-center gap-2"
            >
              <Icons.HelpCircle width={16} height={16} />
              Restart Tour
            </button>
            <p className="text-xs mt-0.5 text-green-600">
              See the interactive tour again to learn all features.
            </p>
          </div>

          <div data-tour="export">
            <h3 className="text-xs font-medium mb-1 text-green-800 flex items-center gap-1">
              <Icons.Download width={14} height={14} />
              Export
            </h3>
            <button
              onClick={onExport}
              className="w-full py-1.5 px-3 rounded text-sm font-medium transition-all bg-lime-500 hover:bg-lime-600 text-white border-2 border-lime-600 flex items-center justify-center gap-2"
            >
              <Icons.Download width={16} height={16} />
              Export to CSV
            </button>
            <p className="text-xs mt-0.5 text-green-600">
              Download all entries as a CSV file.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-medium mb-1 text-green-800">Danger Zone</h3>
            <button
              onClick={handleResetAll}
              className="w-full py-1.5 px-3 rounded text-sm font-medium transition-all bg-red-500 hover:bg-red-600 text-white border-2 border-red-600 flex items-center justify-center gap-2"
            >
              <Icons.Trash2 width={16} height={16} />
              Reset All Data
            </button>
            <p className="text-xs mt-0.5 text-green-600">
              Permanently delete all entries. This action cannot be undone.
            </p>
            <button
              onClick={() => {
                onLogout?.();
                onClose();
              }}
              className="w-full py-1.5 px-3 rounded text-sm font-medium transition-all mt-3 bg-red-500 hover:bg-red-600 text-white border-2 border-red-600 flex items-center justify-center gap-2"
            >
              <Icons.LogOut width={16} height={16} />
              Sign Out
            </button>
            <p className="text-xs mt-0.5 text-green-600">
              End your session and sign out.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
