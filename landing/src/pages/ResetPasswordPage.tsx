import { useEffect, useState } from 'react'
import { useRouter } from '../components/router'

function getToken(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('token') ?? ''
}

export default function ResetPasswordPage() {
  const { navigate } = useRouter()
  const [token] = useState(getToken)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [isValidToken, setIsValidToken] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('No reset token provided')
        setIsVerifying(false)
        return
      }
      try {
        const res = await fetch(`/api/auth/verify-reset-token/${token}`)
        const data = await res.json()
        setIsValidToken(Boolean(data.valid))
        if (!data.valid) {
          setError(data.message || 'This reset link is invalid or has expired.')
        }
      } catch {
        setError('Failed to verify reset link')
        setIsValidToken(false)
      } finally {
        setIsVerifying(false)
      }
    }
    verifyToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to reset password')
      }
      setSuccess(true)
      setMessage('Your password has been reset. Open the Earnings Ninja app and log in with your new password.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <span className="text-[#facc15] drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]">Earnings Ninja</span>
            <span aria-hidden>🥷</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#facc15]/20 bg-[#111] p-6 md:p-8 shadow-[0_0_40px_rgba(250,204,21,0.08)]">
          <h1 className="text-xl font-bold text-white mb-1">Reset password</h1>

          {isVerifying ? (
            <p className="text-zinc-400 text-sm mt-4">Verifying reset link…</p>
          ) : !isValidToken ? (
            <div className="space-y-5 mt-4">
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
                {error || 'This reset link is invalid or has expired.'}
              </div>
              <p className="text-zinc-500 text-sm">
                Request a new link from the Forgot Password screen in the app.
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 rounded-lg bg-[#facc15] hover:bg-[#eab308] text-black font-bold transition-colors"
              >
                Back to home
              </button>
            </div>
          ) : success ? (
            <div className="space-y-5 mt-4">
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-300 text-sm">
                {message}
              </div>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 rounded-lg bg-[#facc15] hover:bg-[#eab308] text-black font-bold transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-zinc-400 text-sm mb-6 mt-1">Enter your new password below.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">New password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-zinc-700 text-white placeholder-zinc-600 focus:outline-none focus:border-[#facc15]"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Confirm password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-zinc-700 text-white placeholder-zinc-600 focus:outline-none focus:border-[#facc15]"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-lg bg-[#facc15] hover:bg-[#eab308] text-black font-bold transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Resetting…' : 'Reset password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
