import { useState, useEffect } from 'react';
import { Settings, api } from '../lib/api';
import { useTheme } from '../lib/themeContext';
import { getAllThemes, ThemeName } from '../lib/themes';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onResetAll?: () => void;
}

interface OAuthStatus {
  [key: string]: { connected: boolean; token_expires_at: string | null };
}

export function SettingsDrawer({ isOpen, onClose, settings, onSave, onResetAll }: SettingsDrawerProps) {
  const { theme, setTheme, config } = useTheme();
  const [costPerMile, setCostPerMile] = useState(settings.cost_per_mile.toString());
  const [oauthStatus, setOAuthStatus] = useState<OAuthStatus>({});
  const [loadingOAuth, setLoadingOAuth] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchOAuthStatus();
    }
  }, [isOpen]);

  const fetchOAuthStatus = async () => {
    try {
      const status = await api.getOAuthStatus();
      setOAuthStatus(status);
    } catch (error) {
      console.error('Failed to fetch OAuth status:', error);
    }
  };

  const handleConnectUber = async () => {
    setLoadingOAuth(true);
    try {
      const { auth_url } = await api.getUberAuthUrl();
      window.open(auth_url, '_blank', 'width=500,height=600');
      // Refresh status after a delay
      setTimeout(fetchOAuthStatus, 2000);
    } catch (error) {
      console.error('Failed to connect Uber:', error);
    }
    setLoadingOAuth(false);
  };

  const handleConnectShipt = async () => {
    setLoadingOAuth(true);
    try {
      const { auth_url } = await api.getShiptAuthUrl();
      window.open(auth_url, '_blank', 'width=500,height=600');
      // Refresh status after a delay
      setTimeout(fetchOAuthStatus, 2000);
    } catch (error) {
      console.error('Failed to connect Shipt:', error);
    }
    setLoadingOAuth(false);
  };

  const handleDisconnect = async (platform: string) => {
    try {
      await api.disconnectPlatform(platform);
      fetchOAuthStatus();
    } catch (error) {
      console.error(`Failed to disconnect ${platform}:`, error);
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ cost_per_mile: parseFloat(costPerMile) });
    onClose();
  };

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

        <div className="mb-6">
          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
            Cost Per Mile ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={costPerMile}
            onChange={(e) => setCostPerMile(e.target.value)}
            className={`w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 ${
              isDark
                ? 'bg-slate-800 border border-slate-700 text-white focus:ring-cyan-400 focus:border-cyan-400'
                : 'bg-white border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
            }`}
          />
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            This is used to calculate profit from mileage
          </p>
        </div>

        <button
          onClick={handleSave}
          className={`w-full py-3 rounded-lg font-medium mb-3 transition-all ${config.buttonPrimary} ${config.buttonPrimaryText}`}
        >
          Save Settings
        </button>

        <div className={`pt-6 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
          <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Platform Integrations</h3>
          <div className="space-y-3">
            {/* Uber Connection */}
            <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">🚗 Uber Eats</span>
                <span className={`text-xs font-medium ${oauthStatus['UBER']?.connected ? 'text-green-500' : 'text-gray-500'}`}>
                  {oauthStatus['UBER']?.connected ? '✓ Connected' : 'Not connected'}
                </span>
              </div>
              {oauthStatus['UBER']?.connected ? (
                <button
                  onClick={() => handleDisconnect('UBER')}
                  className={`w-full py-2 rounded text-sm font-medium transition-all ${
                    isDark
                      ? 'bg-red-900/30 hover:bg-red-900/50 border border-red-500 text-red-400'
                      : 'bg-red-50 hover:bg-red-100 border border-red-300 text-red-600'
                  }`}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectUber}
                  disabled={loadingOAuth}
                  className={`w-full py-2 rounded text-sm font-medium transition-all ${
                    isDark
                      ? 'bg-cyan-500/30 hover:bg-cyan-500/40 border border-cyan-400 text-cyan-300'
                      : 'bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-600'
                  } disabled:opacity-50`}
                >
                  {loadingOAuth ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>

            {/* Shipt Connection */}
            <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">🛒 Shipt</span>
                <span className={`text-xs font-medium ${oauthStatus['SHIPT']?.connected ? 'text-green-500' : 'text-gray-500'}`}>
                  {oauthStatus['SHIPT']?.connected ? '✓ Connected' : 'Not connected'}
                </span>
              </div>
              {oauthStatus['SHIPT']?.connected ? (
                <button
                  onClick={() => handleDisconnect('SHIPT')}
                  className={`w-full py-2 rounded text-sm font-medium transition-all ${
                    isDark
                      ? 'bg-red-900/30 hover:bg-red-900/50 border border-red-500 text-red-400'
                      : 'bg-red-50 hover:bg-red-100 border border-red-300 text-red-600'
                  }`}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectShipt}
                  disabled={loadingOAuth}
                  className={`w-full py-2 rounded text-sm font-medium transition-all ${
                    isDark
                      ? 'bg-cyan-500/30 hover:bg-cyan-500/40 border border-cyan-400 text-cyan-300'
                      : 'bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-600'
                  } disabled:opacity-50`}
                >
                  {loadingOAuth ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
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
