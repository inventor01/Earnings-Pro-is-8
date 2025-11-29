import { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';

export function LoginPage() {
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const { login } = useAuth();
  const { config } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body = mode === 'login' 
        ? { credential, password }
        : { email: credential, password, username };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `${mode === 'login' ? 'Login' : 'Signup'} failed`);
      }

      const data = await res.json();
      login(data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const isDarkTheme = false;

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${config.dashBg} ${config.dashFrom} ${config.dashTo} ${config.dashVia ? config.dashVia : ''}`}>
      <div className={`w-full max-w-md rounded-xl shadow-2xl p-8 ${
        isDarkTheme
          ? 'bg-slate-900 border border-slate-700'
          : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🚗</div>
          <h1 className={`text-3xl font-black mb-2 ${config.titleColor}`}>
            Earnings Ninja
          </h1>
          <p className={`text-sm font-semibold ${isDarkTheme ? 'text-slate-300' : 'text-gray-700'} mb-1`}>
            Grow your earnings with Earnings Ninja
          </p>
          <p className={`text-xs ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
            Track your delivery driver earnings
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkTheme ? 'text-slate-300' : 'text-gray-700'
              }`}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="deliverydriver99"
                className={`w-full px-4 py-2 rounded-lg border-2 focus:outline-none transition-all ${
                  isDarkTheme
                    ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-lime-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-lime-500'
                }`}
              />
            </div>
          )}
          
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkTheme ? 'text-slate-300' : 'text-gray-700'
            }`}>
              {mode === 'login' ? 'Email or Username' : 'Email'}
            </label>
            <input
              type={mode === 'login' ? 'text' : 'email'}
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder={mode === 'login' ? 'you@example.com or deliverydriver99' : 'you@example.com'}
              className={`w-full px-4 py-2 rounded-lg border-2 focus:outline-none transition-all ${
                isDarkTheme
                  ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-lime-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-lime-500'
              }`}
              required
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkTheme ? 'text-slate-300' : 'text-gray-700'
            }`}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 py-2 rounded-lg border-2 focus:outline-none transition-all ${
                isDarkTheme
                  ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-lime-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-lime-500'
              }`}
              required
            />
          </div>

          {error && (
            <div className={`p-3 rounded-lg text-sm ${
              isDarkTheme
                ? 'bg-red-900/30 border border-red-500/50 text-red-300'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-lg font-bold transition-all ${config.buttonPrimary} ${config.buttonPrimaryText} disabled:opacity-50`}
          >
            {isLoading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Mode Toggle */}
        <div className={`mt-6 text-center text-sm ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className={`font-semibold transition-colors ${
              isDarkTheme
                ? 'text-lime-400 hover:text-lime-300'
                : 'text-lime-600 hover:text-lime-700'
            }`}
          >
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>

        {/* Demo Mode */}
        <div className={`mt-6 pt-6 border-t ${isDarkTheme ? 'border-slate-700' : 'border-gray-200'}`}>
          <p className={`text-xs text-center mb-3 ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
            Or continue as guest (limited features)
          </p>
          <button
            type="button"
            onClick={() => login('guest-token')}
            className={`w-full py-2 rounded-lg font-medium transition-all text-sm ${
              isDarkTheme
                ? 'bg-lime-900/30 hover:bg-lime-900/50 text-lime-600 border border-lime-500'
                : 'bg-lime-100 hover:bg-lime-200 text-green-700 border border-lime-400'
            }`}
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
