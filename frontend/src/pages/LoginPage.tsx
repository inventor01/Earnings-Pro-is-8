import { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { useTheme } from '../lib/themeContext';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import ninjaLogo from '../assets/logo-ninja-official.png';

export function LoginPage() {
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { login } = useAuth();
  const { config } = useTheme();
  const isDarkTheme = config.name === 'ninja-dark';

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

  const handleDemoLogin = async () => {
    setError('');
    setIsDemoLoading(true);
    
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error('Failed to create demo session');
      }

      const data = await res.json();
      login(data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start demo');
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${config.dashBg} ${config.dashFrom} ${config.dashTo} ${config.dashVia ? config.dashVia : ''}`}>
      <div className={`w-full max-w-md rounded-xl shadow-2xl p-4 md:p-8 ${
        isDarkTheme
          ? 'bg-gray-800 border border-gray-700'
          : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <img 
            src={ninjaLogo} 
            alt="Earnings Ninja" 
            className="h-48 md:h-72 w-auto mx-auto mb-3 md:mb-4 drop-shadow-lg"
          />
          <p className={`text-xs md:text-sm font-semibold ${isDarkTheme ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
            Grow your earnings with Earnings Ninja
          </p>
          <p className={`text-xs ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
            Track your delivery driver earnings
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkTheme ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="deliverydriver99"
                className={`w-full px-4 py-2 rounded-lg border-2 focus:outline-none transition-all focus:border-yellow-500 ${
                  isDarkTheme
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>
          )}
          
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkTheme ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {mode === 'login' ? 'Email or Username' : 'Email'}
            </label>
            <input
              type={mode === 'login' ? 'text' : 'email'}
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder={mode === 'login' ? 'you@example.com or deliverydriver99' : 'you@example.com'}
              className={`w-full px-4 py-2 rounded-lg border-2 focus:outline-none transition-all focus:border-yellow-500 ${
                isDarkTheme
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              required
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkTheme ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full px-4 py-2 rounded-lg border-2 focus:outline-none transition-all focus:border-yellow-500 ${
                isDarkTheme
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
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
            className="w-full py-3 rounded-lg font-bold transition-all bg-yellow-500 hover:bg-yellow-400 text-gray-900 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Forgot Password Link */}
        {mode === 'login' && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm transition-colors text-yellow-500 hover:text-yellow-400"
            >
              Forgot password?
            </button>
          </div>
        )}

        {/* Mode Toggle */}
        <div className={`mt-6 text-center text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="font-semibold transition-colors text-yellow-500 hover:text-yellow-400"
          >
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>

        {/* Demo Mode */}
        <div className={`mt-6 pt-6 border-t ${isDarkTheme ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className={`text-xs text-center mb-3 ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
            Or try it out first
          </p>
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isDemoLoading}
            className="w-full py-2 rounded-lg font-medium transition-all text-sm bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 border border-yellow-500 disabled:opacity-50"
          >
            {isDemoLoading ? 'Starting Demo...' : 'Try Demo (Private Session)'}
          </button>
          <p className={`text-xs text-center mt-2 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
            Your demo data is private and won't be shared
          </p>
        </div>

        <ForgotPasswordModal 
          isOpen={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />
      </div>
    </div>
  );
}
