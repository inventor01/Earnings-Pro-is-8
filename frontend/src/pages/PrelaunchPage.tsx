import { useState, useEffect } from 'react';
import ninjaLogo from '../assets/logo-ninja-official.png';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showManualInstructions, setShowManualInstructions] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowManualInstructions(true);
    }
  };

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

          {!isInstalled && (
            <div className="mb-4 md:mb-6">
              {isIos ? (
                <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-5 border border-yellow-500/30 shadow-lg">
                  <p className="text-white font-bold text-base mb-2 text-center">Install Earnings Ninja</p>
                  <div className="flex items-start gap-3 mb-2">
                    <span className="bg-yellow-500 text-gray-900 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm shrink-0">1</span>
                    <p className="text-gray-300 text-sm">
                      Tap the <strong className="text-blue-400">Share</strong> button
                      <svg className="w-5 h-5 text-blue-400 inline mx-1 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      at the bottom of Safari
                    </p>
                  </div>
                  <div className="flex items-start gap-3 mb-2">
                    <span className="bg-yellow-500 text-gray-900 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm shrink-0">2</span>
                    <p className="text-gray-300 text-sm">
                      Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-yellow-500 text-gray-900 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm shrink-0">3</span>
                    <p className="text-gray-300 text-sm">
                      Tap <strong className="text-white">"Add"</strong> in the top right corner
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-green-400 to-emerald-500 text-gray-900 hover:from-green-500 hover:to-emerald-600 transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/50 flex items-center justify-center gap-3"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 3v12m0 0l-4-4m4 4l4-4" />
                    </svg>
                    Install App
                  </button>
                  {showManualInstructions && (
                    <div className="mt-3 bg-slate-800/80 backdrop-blur-sm rounded-2xl p-5 border border-yellow-500/30 shadow-lg">
                      <p className="text-white font-bold text-sm mb-3 text-center">How to Install</p>
                      <div className="flex items-start gap-3 mb-2">
                        <span className="bg-yellow-500 text-gray-900 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm shrink-0">1</span>
                        <p className="text-gray-300 text-sm">
                          Open this page in <strong className="text-white">Chrome</strong> on your phone (not inside another app)
                        </p>
                      </div>
                      <div className="flex items-start gap-3 mb-2">
                        <span className="bg-yellow-500 text-gray-900 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm shrink-0">2</span>
                        <p className="text-gray-300 text-sm">
                          Tap the <strong className="text-white">three-dot menu</strong> (top right corner)
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="bg-yellow-500 text-gray-900 rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm shrink-0">3</span>
                        <p className="text-gray-300 text-sm">
                          Tap <strong className="text-white">"Install app"</strong> or <strong className="text-white">"Add to Home screen"</strong>
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {isInstalled && (
            <div className="mb-4 md:mb-6 bg-green-900/30 border border-green-500/30 rounded-2xl p-4 text-center">
              <p className="text-green-400 font-bold flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                App Installed!
              </p>
            </div>
          )}

          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-slate-700 shadow-2xl">
            {submitted ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-xl font-bold text-yellow-400 mb-2">You're In!</h2>
                <p className="text-gray-300">{message}</p>
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
