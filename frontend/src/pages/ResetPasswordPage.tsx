import { useState, useEffect } from 'react';

interface ResetPasswordPageProps {
  token: string;
  onBack: () => void;
}

export function ResetPasswordPage({ token, onBack }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/auth/verify-reset-token/${token}`);
        const data = await res.json();
        setIsValidToken(data.valid);
        if (!data.valid) {
          setError(data.message || 'Invalid or expired reset link');
        }
      } catch {
        setError('Failed to verify reset link');
        setIsValidToken(false);
      } finally {
        setIsVerifying(false);
      }
    };

    if (token) {
      verifyToken();
    } else {
      setIsVerifying(false);
      setError('No reset token provided');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }

      setSuccess(true);
      setMessage('Password has been reset successfully! You can now log in with your new password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-lime-50 to-green-100">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">&#9881;</div>
          <p className="text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-lime-50 to-green-100 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h1>
        
        {!isValidToken ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
              {error || 'This reset link is invalid or has expired.'}
            </div>
            <button
              onClick={onBack}
              className="w-full py-3 rounded-lg bg-lime-500 hover:bg-lime-600 text-white font-bold transition-all"
            >
              Back to Login
            </button>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-700">
              {message}
            </div>
            <button
              onClick={onBack}
              className="w-full py-3 rounded-lg bg-lime-500 hover:bg-lime-600 text-white font-bold transition-all"
            >
              Go to Login
            </button>
          </div>
        ) : (
          <>
            <p className="text-gray-600 text-sm mb-6">
              Enter your new password below.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-lime-500"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-lime-500"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-lg bg-lime-500 hover:bg-lime-600 text-white font-bold transition-all disabled:opacity-50"
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>

              <button
                type="button"
                onClick={onBack}
                className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Back to Login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
