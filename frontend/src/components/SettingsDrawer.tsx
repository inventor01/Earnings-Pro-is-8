import { useState } from 'react';
import { Settings } from '../lib/api';
import { useTheme } from '../lib/themeContext';
import { getAllThemes, ThemeName } from '../lib/themes';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onResetAll?: () => void;
}

export function SettingsDrawer({ isOpen, onClose, settings, onSave, onResetAll }: SettingsDrawerProps) {
  const { theme, setTheme, config } = useTheme();

  if (!isOpen) return null;

  const handleResetAll = () => {
    onResetAll?.();
    onClose();
  };

  const isDark = config.name !== 'simple-light';

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      <div className={`fixed right-0 top-0 h-full w-80 shadow-xl z-50 p-6 ${
        isDark 
          ? 'bg-slate-900 text-slate-100 border-l border-slate-700' 
          : 'bg-white text-gray-900 border-l border-gray-200'
      }`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
          <button onClick={onClose} className={isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-500 hover:text-gray-700'}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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

        <div className={`pt-6 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
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
    </>
  );
}
