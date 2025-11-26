import { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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

  const isDarkTheme = config.name !== 'simple-light';

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${
      isDarkTheme
        ? 'bg-gradient-to-br from-black via-gray-900 to-black'
        : 'bg-gradient-to-br from-gray-50 to-white'
    }`}>
      <div className={`w-full max-w-md rounded-xl shadow-2xl p-8 ${
        isDarkTheme
          ? 'bg-slate-900 border border-slate-700'
          : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🚗</div>
          <h1 className={`text-3xl font-black mb-2 ${config.titleColor}`}>
            EARNINGS PRO
          </h1>
          <p className={`text-sm ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
            Track your delivery driver earnings
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkTheme ? 'text-slate-300' : 'text-gray-700'
            }`}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`w-full px-4 py-2 rounded-lg border-2 focus:outline-none transition-all ${
                isDarkTheme
                  ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
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
                  ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
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
            className={`w-full py-3 rounded-lg font-bold transition-all ${
              isDarkTheme
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 disabled:opacity-50 text-white'
                : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 text-white'
            }`}
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
                ? 'text-cyan-400 hover:text-cyan-300'
                : 'text-blue-600 hover:text-blue-700'
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
                ? 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-600'
                : 'bg-gray-100 hover:bg-gray-200 text-blue-600 border border-gray-300'
            }`}
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
