// Account & data deletion instructions — required by Google Play's Data safety
// form ("Delete account URL") and useful for Apple App Review too.
// Static page: deletion itself happens in-app (Settings → Delete Account) or
// via email request; there is no web-based account login.
export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-16 text-gray-200">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="text-sm font-semibold text-yellow-400 hover:text-yellow-300">
          ← Back to earningsninja.com
        </a>

        <h1 className="mt-6 text-3xl font-black text-white">Delete your Earnings Ninja account</h1>
        <p className="mt-3 text-gray-400">
          You can permanently delete your Earnings Ninja account and all associated data at any
          time. Deletion is immediate and cannot be undone.
        </p>

        <h2 className="mt-10 text-xl font-bold text-white">Option 1 — Delete from the app (fastest)</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-gray-300">
          <li>Open the Earnings Ninja app and log in.</li>
          <li>Go to <span className="font-semibold text-white">Settings</span>.</li>
          <li>Tap <span className="font-semibold text-white">Delete Account</span>.</li>
          <li>Confirm the deletion when prompted.</li>
        </ol>

        <h2 className="mt-10 text-xl font-bold text-white">Option 2 — Request deletion by email</h2>
        <p className="mt-3 text-gray-300">
          If you can no longer access the app, email{' '}
          <a href="mailto:support@earningsninja.com" className="font-semibold text-yellow-400 hover:text-yellow-300">
            support@earningsninja.com
          </a>{' '}
          from the email address on your account with the subject{' '}
          <span className="font-semibold text-white">"Delete my account"</span>. We verify the
          request against the account email and complete the deletion within 30 days.
        </p>

        <h2 className="mt-10 text-xl font-bold text-white">What gets deleted</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-300">
          <li>Your account (email, name, login credentials)</li>
          <li>All earnings, tips, expenses, mileage, and goal data</li>
          <li>App settings and preferences</li>
        </ul>
        <p className="mt-3 text-gray-400">
          All data is deleted permanently at the time your request is processed; we do not retain
          any account data afterward. Subscription billing is managed by Apple or Google — cancel
          your subscription in your App Store or Google Play account settings (deleting your
          account does not automatically cancel a store-managed subscription).
        </p>

        <p className="mt-10 text-sm text-gray-500">
          Questions? Contact{' '}
          <a href="mailto:support@earningsninja.com" className="text-yellow-400 hover:text-yellow-300">
            support@earningsninja.com
          </a>
          . See also our <a href="/privacy" className="text-yellow-400 hover:text-yellow-300">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}
