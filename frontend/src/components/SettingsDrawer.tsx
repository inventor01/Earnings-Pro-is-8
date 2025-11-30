import { useState, useEffect } from 'react';
import { Settings, api } from '../lib/api';
import { useTheme } from '../lib/themeContext';
import { MetricVisibility } from './SummaryCard';
import { Icons } from './Icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { isSoundMuted, setSoundMuted } from '../lib/soundEffects';
import { getAllThemes, type ThemeName } from '../lib/themes';

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
  const { config, setTheme, themeName } = useTheme();
  const [soundMuted, setSoundMutedState] = useState(isSoundMuted());
  const themes = getAllThemes();
  const isDarkTheme = config.name !== 'ninja-green';
  
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

  const handleSoundToggle = () => {
    const newMuted = !soundMuted;
    setSoundMutedState(newMuted);
    setSoundMuted(newMuted);
  };

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
      <div className={`fixed inset-y-0 right-0 w-full sm:w-96 shadow-2xl z-50 flex flex-col overflow-hidden ${
        isDarkTheme
          ? 'bg-gradient-to-b from-slate-900 to-slate-800 text-white border-l border-green-500/20'
          : 'bg-gradient-to-b from-white to-gray-50 text-gray-900 border-l border-lime-500/20'
      }`}>
        <div className={`flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b flex-shrink-0 backdrop-blur-sm ${
          isDarkTheme
            ? 'border-slate-700 bg-slate-900/50'
            : 'border-gray-200/50'
        }`}>
          <h2 className={`text-base sm:text-lg font-bold flex items-center gap-2 sm:gap-3 ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
            <div className={`p-2 rounded-lg ${isDarkTheme ? 'bg-green-500/20' : 'bg-lime-100'}`}>
              <Icons.Settings width={18} height={18} className={isDarkTheme ? 'text-green-400' : 'text-lime-700'} strokeWidth={2} />
            </div>
            <span className="hidden sm:inline">Settings</span>
          </h2>
          <button onClick={onClose} className={`w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
            isDarkTheme
              ? 'text-slate-400 hover:text-white hover:bg-slate-700'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`} aria-label="Close settings">
            <Icons.X width={20} height={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-24 sm:pb-28 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent">
          {userInfo && (
            <div className={`mb-6 mt-4 p-4 rounded-xl border ${
              isDarkTheme
                ? 'bg-gradient-to-br from-green-500/10 to-slate-800 border-green-500/30'
                : 'bg-gradient-to-br from-lime-50 to-white border-lime-200/60'
            }`}>
              <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
                <Icons.User width={16} height={16} className={isDarkTheme ? 'text-green-400' : 'text-lime-600'} strokeWidth={2} />
                Account Information
              </h3>
              <div className="space-y-2.5 text-sm">
                <div>
                  <p className={`text-xs font-medium ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>Username</p>
                  <p className={`font-semibold mt-0.5 ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>{userInfo.first_name}</p>
                </div>
                <div>
                  <p className={`text-xs font-medium ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>Email</p>
                  <p className={`font-semibold break-all mt-0.5 text-sm ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>{userInfo.email}</p>
                </div>
              </div>
            </div>
          )}

          <div className={`py-6 border-t ${isDarkTheme ? 'border-slate-700' : 'border-gray-200/50'}`}>
            <h3 className={`text-sm font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>Appearance</h3>
            <div className="space-y-2">
              {themes.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => setTheme(theme.name as ThemeName)}
                  className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left flex items-center gap-3 border ${
                    themeName === theme.name
                      ? isDarkTheme
                        ? 'bg-green-500/20 border-green-400 text-white ring-2 ring-green-400'
                        : 'bg-lime-100 border-lime-300 text-gray-900 ring-2 ring-lime-400'
                      : isDarkTheme
                      ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="radio"
                    checked={themeName === theme.name}
                    onChange={() => {}}
                    className={`w-4 h-4 cursor-pointer ${isDarkTheme ? 'accent-green-400' : 'accent-lime-600'}`}
                  />
                  <span>{theme.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`py-6 border-t ${isDarkTheme ? 'border-slate-700' : 'border-gray-200/50'}`}>
            <h3 className={`text-sm font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>Audio Settings</h3>
            <button
              onClick={handleSoundToggle}
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left flex items-center gap-3 border ${
                !soundMuted
                  ? isDarkTheme
                    ? 'bg-green-500/20 border-green-400 text-white'
                    : 'bg-lime-100 border-lime-200 text-gray-900'
                  : isDarkTheme
                  ? 'bg-slate-700 border-slate-600 text-slate-400 opacity-60'
                  : 'bg-gray-50 border-gray-200 text-gray-400 opacity-60'
              }`}
            >
              <input
                type="checkbox"
                checked={!soundMuted}
                onChange={() => {}}
                className={`w-4 h-4 cursor-pointer ${isDarkTheme ? 'accent-green-400' : 'accent-lime-600'}`}
              />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={16} height={16} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a7 7 0 0 1 0 9.9M19.07 4.93a11 11 0 0 1 0 15.66" />
              </svg>
              <span>Sound Effects</span>
            </button>
          </div>

          <div className={`py-6 border-t ${isDarkTheme ? 'border-slate-700' : 'border-gray-200/50'}`}>
            <h3 className={`text-sm font-semibold mb-4 ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>Performance Overview Metrics</h3>
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
                      ? isDarkTheme
                        ? 'bg-green-500/20 border-green-400 text-white'
                        : 'bg-lime-100 border-lime-200 text-gray-900'
                      : isDarkTheme
                      ? 'bg-slate-700 border-slate-600 text-slate-400 opacity-60'
                      : 'bg-gray-50 border-gray-200 text-gray-400 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={metricVisibility[key] !== false}
                    onChange={() => {}}
                    className={`w-4 h-4 cursor-pointer ${isDarkTheme ? 'accent-green-400' : 'accent-lime-600'}`}
                  />
                  <IconComponent width={16} height={16} strokeWidth={1.5} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`border-t p-3 sm:p-4 flex-shrink-0 space-y-2 pb-6 sm:pb-4 ${isDarkTheme ? 'border-slate-700 bg-slate-900/50' : 'border-gray-200/50'}`}>
          <div>
            <h3 className={`text-xs font-semibold mb-1.5 flex items-center gap-1 ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
              <Icons.HelpCircle width={12} height={12} className={isDarkTheme ? 'text-slate-400' : 'text-gray-600'} strokeWidth={2} />
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
            <p className={`text-xs mt-0.5 ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
              Learn all features with the interactive tour.
            </p>
          </div>

          <div data-tour="export">
            <h3 className={`text-xs font-semibold mb-1.5 flex items-center gap-1 ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>
              <Icons.Download width={12} height={12} className={isDarkTheme ? 'text-slate-400' : 'text-gray-600'} strokeWidth={2} />
              Export
            </h3>
            <button
              onClick={onExport}
              className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all border flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg ${
                isDarkTheme
                  ? 'bg-green-600 hover:bg-green-700 text-white border-green-700'
                  : 'bg-lime-500 hover:bg-lime-600 text-white border-lime-600'
              }`}
            >
              <Icons.Download width={14} height={14} strokeWidth={2} />
              Export to CSV
            </button>
            <p className={`text-xs mt-0.5 ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
              Download all entries as CSV.
            </p>
          </div>

          <div>
            <h3 className={`text-xs font-semibold mb-1.5 ${isDarkTheme ? 'text-red-400' : 'text-red-700'}`}>Danger Zone</h3>
            <button
              onClick={handleResetAll}
              className="w-full py-1.5 px-2.5 pl-4 rounded-lg text-xs font-medium transition-all bg-red-500 hover:bg-red-600 text-white border border-red-600 flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg"
            >
              <Icons.Trash2 width={14} height={14} strokeWidth={2} />
              Reset All Data
            </button>
            <p className={`text-xs mt-0.5 ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
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
            <p className={`text-xs mt-0.5 ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
              End your session.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
