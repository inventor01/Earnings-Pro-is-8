import { Settings } from '../lib/api';
import { useTheme } from '../lib/themeContext';
import { MetricVisibility } from './SummaryCard';
import { Icons } from './Icons';
import { useQuery } from '@tanstack/react-query';

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
      <div className="fixed right-0 top-0 h-full w-full md:w-80 shadow-2xl z-50 flex flex-col bg-gradient-to-b from-white to-gray-50 text-gray-900 border-l border-lime-500/20">
        <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200/50 flex-shrink-0 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-lime-100 rounded-lg">
              <Icons.Settings width={18} height={18} className="text-lime-700" strokeWidth={2} />
            </div>
            Settings
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
            <Icons.X width="100%" height="100%" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          {userInfo && (
            <div className="mb-6 mt-4 p-4 rounded-xl bg-gradient-to-br from-lime-50 to-white border border-lime-200/60">
              <h3 className="text-sm font-semibold mb-3 text-gray-900 flex items-center gap-2">
                <Icons.User width={16} height={16} className="text-lime-600" strokeWidth={2} />
                Account Information
              </h3>
              <div className="space-y-2.5 text-sm">
                <div>
                  <p className="text-gray-600 text-xs font-medium">Username</p>
                  <p className="font-semibold text-gray-900 mt-0.5">{userInfo.first_name}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-xs font-medium">Email</p>
                  <p className="font-semibold break-all text-gray-900 mt-0.5 text-sm">{userInfo.email}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="py-6 border-t border-gray-200/50">
            <h3 className="text-sm font-semibold mb-4 text-gray-900">Performance Overview Metrics</h3>
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
                  className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left flex items-center gap-3 border ${
                    metricVisibility[key] !== false
                      ? 'bg-lime-100 border-lime-200 text-gray-900'
                      : 'bg-gray-50 border-gray-200 text-gray-400 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={metricVisibility[key] !== false}
                    onChange={() => {}}
                    className="w-4 h-4 cursor-pointer accent-lime-600"
                  />
                  <IconComponent width={16} height={16} strokeWidth={1.5} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200/50 p-3 flex-shrink-0 space-y-2">
          <div>
            <h3 className="text-xs font-semibold mb-1.5 text-gray-900 flex items-center gap-1">
              <Icons.HelpCircle width={12} height={12} className="text-gray-600" strokeWidth={2} />
              Help & Tutorial
            </h3>
            <button
              onClick={() => {
                onRestartTour?.();
                onClose();
              }}
              className="w-full py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all bg-yellow-500 hover:bg-yellow-600 text-white border border-yellow-600 flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg"
            >
              <Icons.HelpCircle width={14} height={14} strokeWidth={2} />
              Restart Tour
            </button>
            <p className="text-xs mt-0.5 text-gray-600">
              Learn all features with the interactive tour.
            </p>
          </div>

          <div data-tour="export">
            <h3 className="text-xs font-semibold mb-1.5 text-gray-900 flex items-center gap-1">
              <Icons.Download width={12} height={12} className="text-gray-600" strokeWidth={2} />
              Export
            </h3>
            <button
              onClick={onExport}
              className="w-full py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all bg-lime-500 hover:bg-lime-600 text-white border border-lime-600 flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg"
            >
              <Icons.Download width={14} height={14} strokeWidth={2} />
              Export to CSV
            </button>
            <p className="text-xs mt-0.5 text-gray-600">
              Download all entries as CSV.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold mb-1.5 text-red-700">Danger Zone</h3>
            <button
              onClick={handleResetAll}
              className="w-full py-1.5 px-2.5 pl-4 rounded-lg text-xs font-medium transition-all bg-red-500 hover:bg-red-600 text-white border border-red-600 flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg"
            >
              <Icons.Trash2 width={14} height={14} strokeWidth={2} />
              Reset All Data
            </button>
            <p className="text-xs mt-0.5 text-gray-600">
              Permanently delete all entries. Cannot be undone.
            </p>
            <button
              onClick={() => {
                onLogout?.();
                onClose();
              }}
              className="w-full py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all mt-1.5 bg-red-500 hover:bg-red-600 text-white border border-red-600 flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg"
            >
              <Icons.LogOut width={14} height={14} strokeWidth={2} />
              Sign Out
            </button>
            <p className="text-xs mt-0.5 text-gray-600">
              End your session.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
