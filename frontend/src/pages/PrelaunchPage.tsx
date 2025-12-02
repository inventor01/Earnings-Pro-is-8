import { useState } from 'react';
import ninjaLogo from '../assets/logo-ninja-official.png';

interface PrelaunchPageProps {
  onGoToLogin: () => void;
}

export function PrelaunchPage({ onGoToLogin }: PrelaunchPageProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/waitlist/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name || undefined }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmitted(true);
        setMessage(data.message);
      } else {
        setError(data.detail || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Failed to connect. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessError('');
    setIsVerifying(true);

    try {
      const res = await fetch('/api/waitlist/verify-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_code: accessCode }),
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        onGoToLogin();
      } else {
        setAccessError(data.detail || 'Invalid access code');
      }
    } catch {
      setAccessError('Failed to verify. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="text-center mb-4 md:mb-8">
            <img 
              src={ninjaLogo} 
              alt="Earnings Ninja" 
              className="h-28 md:h-56 w-auto mx-auto mb-2 md:mb-4 drop-shadow-lg"
              style={{ filter: 'drop-shadow(0 0 8px rgba(250, 204, 21, 0.4))' }}
            />
            <h1 className="text-2xl md:text-4xl font-black text-white mb-1 md:mb-2">
              Coming Soon
            </h1>
            <p className="text-base md:text-xl text-yellow-400 font-semibold mb-2 md:mb-4">
              The Ultimate Delivery Driver Earnings Tracker
            </p>
            <p className="text-gray-400 text-xs md:text-base max-w-md mx-auto leading-tight md:leading-normal">
              Track your earnings across DoorDash, UberEats, Instacart, GrubHub and more. 
              Set goals, analyze profits, and maximize your income like a ninja.
            </p>
          </div>

          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-slate-700 shadow-2xl">
            {submitted ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-xl font-bold text-yellow-400 mb-2">You're In!</h2>
                <p className="text-gray-300">{message}</p>
                <button
                  onClick={onGoToLogin}
                  className="mt-6 text-yellow-400 hover:text-yellow-300 underline font-medium"
                >
                  Already have early access? Sign in
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white mb-2 text-center">
                  Get Early Access
                </h2>
                <p className="text-gray-400 text-sm text-center mb-6">
                  Be the first to know when we launch
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Name <span className="text-gray-500">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-4 py-3 rounded-xl bg-slate-700 border-2 border-slate-600 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-slate-700 border-2 border-slate-600 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || !email}
                    className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 hover:from-yellow-500 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Joining...
                      </span>
                    ) : (
                      'Notify Me When It Launches'
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-700">
                  <button
                    onClick={() => setShowAccessCode(!showAccessCode)}
                    className="w-full text-center text-yellow-400 hover:text-yellow-300 font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <span>Have an access code?</span>
                    <svg 
                      className={`w-4 h-4 transition-transform ${showAccessCode ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showAccessCode && (
                    <form onSubmit={handleAccessCode} className="mt-4 space-y-3">
                      <input
                        type="password"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        placeholder="Enter access code"
                        className="w-full px-4 py-3 rounded-xl bg-slate-700 border-2 border-slate-600 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors text-center"
                      />
                      {accessError && (
                        <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm text-center">
                          {accessError}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={isVerifying || !accessCode}
                        className="w-full py-3 rounded-xl font-bold bg-slate-600 text-white hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {isVerifying ? 'Verifying...' : 'Enter App'}
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      <footer className="text-center py-6 text-gray-500 text-sm">
        <p>Track your delivery driver earnings like a ninja</p>
      </footer>
    </div>
  );
}
