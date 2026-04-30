import { useState } from 'react'

const APP_STORE_URL: string | null = null
const PRIVACY_URL = '/privacy'
const SUPPORT_URL = '/support'

export default function App() {
  return (
    <div className="min-h-screen text-white">
      <Nav />
      <Hero />
      <FeatureGrid />
      <ShowcaseStrip />
      <Comparison />
      <Faq />
      <CtaBand />
      <Footer />
    </div>
  )
}

function Nav() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-bg/70 border-b border-border">
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <span className="text-2xl">🥷</span>
          <span className="font-extrabold tracking-tight text-lg group-hover:text-primary transition-colors">
            Earnings Ninja
          </span>
        </a>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#showcase" className="hover:text-white transition-colors">Screenshots</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          <a href={SUPPORT_URL} className="hover:text-white transition-colors">Support</a>
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="#top"
            className="hidden sm:inline-flex items-center gap-2 bg-primary text-black font-semibold px-4 py-2 rounded-xl text-sm hover:shadow-neon-yellow hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {APP_STORE_URL ? 'Download' : 'Coming soon'}
          </a>
          <button
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg border border-border text-muted"
          >
            <span className="block w-5 h-[2px] bg-current mb-[5px]" />
            <span className="block w-5 h-[2px] bg-current mb-[5px]" />
            <span className="block w-5 h-[2px] bg-current" />
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-menu" className="md:hidden border-t border-border bg-bg/95">
          <div className="px-5 py-3 flex flex-col gap-3 text-sm">
            <a href="#features" onClick={() => setOpen(false)} className="text-muted hover:text-white">Features</a>
            <a href="#showcase" onClick={() => setOpen(false)} className="text-muted hover:text-white">Screenshots</a>
            <a href="#faq" onClick={() => setOpen(false)} className="text-muted hover:text-white">FAQ</a>
            <a href={SUPPORT_URL} onClick={() => setOpen(false)} className="text-muted hover:text-white">Support</a>
            <a href={PRIVACY_URL} onClick={() => setOpen(false)} className="text-muted hover:text-white">Privacy</a>
          </div>
        </div>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
      <div className="max-w-6xl mx-auto px-5 pt-14 pb-20 md:pt-24 md:pb-28 relative">
        <div className="grid md:grid-cols-2 gap-12 md:gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1 text-xs text-muted mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-slow" />
              Now on iPhone — iOS 17+
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.02] text-balance">
              Know what you{' '}
              <span className="text-primary animate-glow">actually</span> make.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted max-w-xl text-balance">
              Earnings Ninja is the no-BS earnings tracker for delivery drivers. Real profit, real hourly rate,
              real cost-per-mile — across DoorDash, Uber Eats, Instacart, GrubHub & Shipt.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <AppStoreBadge />
              <a
                href="#features"
                className="text-sm text-muted hover:text-white inline-flex items-center gap-1.5"
              >
                See features
                <span aria-hidden>↓</span>
              </a>
            </div>
            <div className="mt-10 flex items-center gap-6 text-xs text-muted">
              <Stat value="$0" label="Forever free to start" />
              <Stat value="0" label="Ads or trackers" />
              <Stat value="9" label="Expense categories" />
            </div>
          </div>
          <div className="relative flex justify-center md:justify-end">
            <div className="absolute -inset-10 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
            <PhoneMockup>
              <DashboardPreview />
            </PhoneMockup>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-extrabold text-white">{value}</div>
      <div className="uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}

function AppStoreBadge() {
  const comingSoon = !APP_STORE_URL
  const Wrapper: React.ElementType = comingSoon ? 'div' : 'a'
  const wrapperProps = comingSoon
    ? { 'aria-label': 'App Store — coming soon', role: 'note' }
    : { href: APP_STORE_URL!, 'aria-label': 'Download on the App Store' }
  return (
    <Wrapper
      {...wrapperProps}
      className={`inline-flex items-center gap-3 bg-black border border-white/20 rounded-2xl px-5 py-3 transition-transform ${
        comingSoon ? 'opacity-90 cursor-default' : 'hover:scale-[1.03] active:scale-[0.97]'
      }`}
    >
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" aria-hidden>
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
      <div className="leading-tight text-left">
        <div className="text-[10px] text-white/70 uppercase tracking-wider">
          {comingSoon ? 'iPhone — App Store' : 'Download on the'}
        </div>
        <div className="text-xl font-semibold text-white">
          {comingSoon ? 'Coming soon' : 'App Store'}
        </div>
      </div>
    </Wrapper>
  )
}

function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[280px] sm:w-[320px] animate-float">
      <div className="relative aspect-[9/19.5] bg-black rounded-[44px] p-2 border border-white/10 shadow-[0_30px_80px_-15px_rgba(250,204,21,0.25),0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className="relative w-full h-full bg-bg rounded-[36px] overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[110px] h-[28px] bg-black rounded-b-[18px] z-20" />
          <div className="absolute inset-0 phone-glare z-30 rounded-[36px]" />
          {children}
        </div>
      </div>
    </div>
  )
}

function DashboardPreview() {
  return (
    <div className="h-full w-full flex flex-col pt-9 px-3.5 pb-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[9px] tracking-[0.25em] text-primary font-bold">EARNINGS NINJA</span>
        <span className="text-[9px] text-muted">TODAY</span>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-2.5">
        <div className="text-[9px] uppercase tracking-wider text-muted">Net Profit</div>
        <div className="text-3xl font-black text-primary mt-0.5" style={{ textShadow: '0 0 14px rgba(250,204,21,0.55)' }}>
          $247.50
        </div>
        <div className="flex justify-between mt-2 text-[10px]">
          <span className="text-green">+$310 revenue</span>
          <span className="text-red">−$62.50 expense</span>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[9px] text-muted mb-1">
            <span>Daily goal</span>
            <span>$247 / $300</span>
          </div>
          <div className="h-1.5 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green to-primary rounded-full"
              style={{ width: '82%', boxShadow: '0 0 8px rgba(250,204,21,0.6)' }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <MiniKpi label="$/Hour" value="$24.75" />
        <MiniKpi label="$/Mile" value="$1.42" />
        <MiniKpi label="Miles" value="174" />
        <MiniKpi label="Avg Order" value="$8.40" />
      </div>

      <div className="bg-card border border-border rounded-2xl p-2.5 flex-1 min-h-0">
        <div className="text-[9px] uppercase tracking-wider text-muted mb-1.5">Recent</div>
        <div className="space-y-1.5">
          <Entry platform="DoorDash" amount="+$12.40" mileage="3.2 mi" positive />
          <Entry platform="Uber Eats" amount="+$8.75" mileage="2.1 mi" positive />
          <Entry platform="Gas ⛽" amount="−$32.00" mileage="" />
          <Entry platform="Instacart" amount="+$19.20" mileage="5.0 mi" positive />
        </div>
      </div>
    </div>
  )
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-2">
      <div className="text-[8px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm font-bold text-white mt-0.5">{value}</div>
    </div>
  )
}

function Entry({
  platform,
  amount,
  mileage,
  positive,
}: {
  platform: string
  amount: string
  mileage: string
  positive?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/60 last:border-0">
      <div>
        <div className="text-[10px] font-semibold text-white">{platform}</div>
        {mileage && <div className="text-[8px] text-muted">{mileage}</div>}
      </div>
      <div className={`text-[11px] font-bold ${positive ? 'text-green' : 'text-red'}`}>{amount}</div>
    </div>
  )
}

function FeatureGrid() {
  const features = [
    {
      icon: '⚡',
      title: 'Calculator-style entry',
      body: 'Tap a number pad like a real cash register. No keyboard, no friction. Log an order in 3 seconds.',
    },
    {
      icon: '📊',
      title: 'Real KPIs, real time',
      body: '$/hour. $/mile. Net profit. Every number updates the moment you log an entry.',
    },
    {
      icon: '🎯',
      title: 'Profit goals',
      body: 'Set daily, weekly, and monthly goals. Watch the bar fill — and the ninja glow when you hit milestones.',
    },
    {
      icon: '📱',
      title: 'iPhone widget',
      body: 'Quick-add buttons on your Home Screen and Lock Screen. Log a tip without unlocking your phone.',
    },
    {
      icon: '🔒',
      title: 'Privacy-first',
      body: 'No ads. No trackers. No third-party analytics. Your data stays yours.',
    },
    {
      icon: '🎨',
      title: 'Three themes',
      body: 'Dark Neon car-dashboard look, Simple Light, or B/W Neon. Switch any time.',
    },
  ]
  return (
    <section id="features" className="scroll-smooth-anchor py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.25em] text-primary font-bold mb-3">Why drivers love it</div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            Built by a driver. Ruthlessly fast.
          </h2>
          <p className="mt-4 text-muted text-lg">
            Other apps tell you your gross. Earnings Ninja tells you what you walked away with after gas, parking,
            and the cost of your car.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/40 hover:-translate-y-1 transition-all"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="font-bold text-lg mb-1.5">{f.title}</div>
              <p className="text-muted text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ShowcaseStrip() {
  return (
    <section id="showcase" className="scroll-smooth-anchor py-20 md:py-28 border-t border-border bg-surface/40">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-xs uppercase tracking-[0.25em] text-primary font-bold mb-3">A look inside</div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            Designed like a car dashboard.
          </h2>
          <p className="mt-4 text-muted text-lg">
            Big numbers. Big targets. Glowing where it matters. Made to read at a glance between stops.
          </p>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-8 md:gap-6 justify-items-center">
          <ShowcaseCard
            title="Dashboard"
            subtitle="Today's haul, at a glance"
            mockup={<DashboardPreview />}
          />
          <ShowcaseCard
            title="Add Entry"
            subtitle="Calculator-style number pad"
            mockup={<CalculatorPreview />}
          />
          <ShowcaseCard
            title="History"
            subtitle="Search, filter, export"
            mockup={<HistoryPreview />}
          />
        </div>
      </div>
    </section>
  )
}

function ShowcaseCard({
  title,
  subtitle,
  mockup,
}: {
  title: string
  subtitle: string
  mockup: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center">
      <PhoneMockup>{mockup}</PhoneMockup>
      <div className="mt-6 text-center">
        <div className="font-bold text-lg">{title}</div>
        <div className="text-sm text-muted">{subtitle}</div>
      </div>
    </div>
  )
}

function CalculatorPreview() {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']
  return (
    <div className="h-full w-full flex flex-col pt-9 px-3.5 pb-3.5">
      <div className="text-[9px] tracking-[0.25em] text-primary font-bold mb-2">ADD ENTRY</div>
      <div className="bg-card border border-border rounded-2xl p-4 mb-2.5 text-center">
        <div className="text-[9px] uppercase tracking-wider text-muted">Amount</div>
        <div className="text-4xl font-black text-primary mt-1" style={{ textShadow: '0 0 14px rgba(250,204,21,0.55)' }}>
          $24.75
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mb-2.5">
        {['Order', 'Bonus', 'Expense', 'Cancel'].map((t, i) => (
          <div
            key={t}
            className={`text-[9px] py-1.5 rounded-lg border font-semibold text-center ${
              i === 0 ? 'bg-primary text-black border-primary' : 'bg-card text-muted border-border'
            }`}
          >
            {t}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 flex-1">
        {keys.map((k) => (
          <div
            key={k}
            className="bg-card border border-border rounded-xl flex items-center justify-center text-base font-bold text-white"
          >
            {k}
          </div>
        ))}
      </div>
      <div className="mt-2 bg-green text-black text-center text-xs font-bold py-2 rounded-xl">SAVE</div>
    </div>
  )
}

function HistoryPreview() {
  const rows = [
    { p: 'DoorDash', t: 'Order', a: '+$14.20', d: '6:42 PM' },
    { p: 'Uber Eats', t: 'Order', a: '+$9.80', d: '6:18 PM' },
    { p: 'Gas ⛽', t: 'Expense', a: '−$45.00', d: '5:50 PM', neg: true },
    { p: 'Instacart', t: 'Order', a: '+$22.10', d: '5:21 PM' },
    { p: 'DoorDash', t: 'Bonus', a: '+$5.00', d: '4:48 PM' },
    { p: 'GrubHub', t: 'Order', a: '+$11.50', d: '4:12 PM' },
    { p: 'Tolls 🛣️', t: 'Expense', a: '−$3.25', d: '3:55 PM', neg: true },
    { p: 'Shipt', t: 'Order', a: '+$18.40', d: '3:30 PM' },
  ]
  return (
    <div className="h-full w-full flex flex-col pt-9 px-3.5 pb-3.5">
      <div className="text-[9px] tracking-[0.25em] text-primary font-bold mb-2">HISTORY</div>
      <div className="bg-card border border-border rounded-xl px-2 py-1.5 text-[10px] text-muted mb-2">
        🔍 Search entries…
      </div>
      <div className="flex gap-1.5 mb-2 text-[8px]">
        {['Today', 'Week', 'Month', 'All'].map((p, i) => (
          <div
            key={p}
            className={`px-2 py-1 rounded-lg border font-semibold ${
              i === 0 ? 'bg-primary text-black border-primary' : 'bg-card text-muted border-border'
            }`}
          >
            {p}
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-2xl p-2 flex-1 min-h-0 overflow-hidden">
        <div className="space-y-1.5">
          {rows.map((r, idx) => (
            <div key={idx} className="flex items-center justify-between py-1 border-b border-border/60 last:border-0">
              <div>
                <div className="text-[10px] font-semibold text-white">{r.p}</div>
                <div className="text-[8px] text-muted">{r.t} · {r.d}</div>
              </div>
              <div className={`text-[11px] font-bold ${r.neg ? 'text-red' : 'text-green'}`}>{r.a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Comparison() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-5xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs uppercase tracking-[0.25em] text-primary font-bold mb-3">The honest math</div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            What the gig apps don't tell you.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-7">
            <div className="text-xs uppercase tracking-wider text-muted mb-3">What DoorDash shows you</div>
            <div className="text-4xl font-black text-white">$310.00</div>
            <div className="text-sm text-muted mt-1">"Earnings"</div>
            <ul className="mt-6 space-y-2 text-sm text-muted">
              <li>• No gas deducted</li>
              <li>• No parking, no tolls</li>
              <li>• No vehicle depreciation</li>
              <li>• No real hourly rate</li>
            </ul>
          </div>
          <div className="bg-card border border-primary/40 rounded-2xl p-7 shadow-neon-yellow">
            <div className="text-xs uppercase tracking-wider text-primary mb-3">What Earnings Ninja shows you</div>
            <div className="text-4xl font-black text-primary" style={{ textShadow: '0 0 16px rgba(250,204,21,0.6)' }}>
              $186.40
            </div>
            <div className="text-sm text-muted mt-1">Real net profit · $14.34/hr</div>
            <ul className="mt-6 space-y-2 text-sm text-white/90">
              <li className="flex justify-between"><span className="text-muted">Gross</span> <span>$310.00</span></li>
              <li className="flex justify-between"><span className="text-muted">Gas</span> <span className="text-red">−$45.00</span></li>
              <li className="flex justify-between"><span className="text-muted">Tolls</span> <span className="text-red">−$3.25</span></li>
              <li className="flex justify-between"><span className="text-muted">Vehicle (IRS rate)</span> <span className="text-red">−$75.35</span></li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  const items = [
    {
      q: 'Which delivery platforms does it support?',
      a: 'DoorDash, Uber Eats, Instacart, GrubHub, and Shipt. You can also log entries under "Other" for any gig the app doesn\'t list by name.',
    },
    {
      q: 'How is my net profit calculated?',
      a: 'Net profit = revenue (orders + bonuses) minus expenses (gas, tolls, parking, etc.) minus your vehicle cost (miles driven × your cost-per-mile, or the IRS standard rate of $0.67/mi).',
    },
    {
      q: 'Do I have to log every order by hand?',
      a: 'Yes — and that\'s on purpose. Entries take about 3 seconds with the calculator pad, and the discipline of logging makes you a better driver. The Home Screen widget makes it even faster.',
    },
    {
      q: 'Does the app track my location?',
      a: 'Only when you explicitly start a trip. Earnings Ninja includes an optional GPS trip tracker that calculates the distance of a single delivery — you choose when to start and stop it. We don\'t track your location in the background, sell location data, or share it with third parties. You can also enter mileage manually if you prefer never to grant location access at all.',
    },
    {
      q: 'Is my data private?',
      a: 'Yes. No ads. No analytics SDKs. No data sold to third parties. The only outside service that ever sees anything is the email provider that sends your password-reset emails. Full details on the Privacy page.',
    },
    {
      q: 'How much does it cost?',
      a: 'Free to download and use. We may add optional pro features later, but the core tracker stays free.',
    },
    {
      q: 'What iPhones is it compatible with?',
      a: 'iPhone running iOS 17 or later. The Home Screen and Lock Screen widgets require iOS 17 specifically.',
    },
    {
      q: 'How do I delete my account?',
      a: 'In the app: Settings (gear icon) → Danger Zone → Delete My Account. All your data is permanently removed from our servers.',
    },
  ]
  return (
    <section id="faq" className="scroll-smooth-anchor py-20 md:py-28 border-t border-border bg-surface/40">
      <div className="max-w-3xl mx-auto px-5">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-[0.25em] text-primary font-bold mb-3">Questions</div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Frequently asked.</h2>
        </div>
        <div className="space-y-3">
          {items.map((it) => (
            <FaqItem key={it.q} q={it.q} a={it.a} />
          ))}
        </div>
        <div className="text-center mt-10 text-sm text-muted">
          Still have questions?{' '}
          <a href="mailto:support@earningsninja.app" className="text-primary hover:underline">
            support@earningsninja.app
          </a>
        </div>
      </div>
    </section>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const panelId = `faq-${q.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="font-semibold text-white pr-4">{q}</span>
        <span
          className={`text-primary text-xl flex-shrink-0 transition-transform ${open ? 'rotate-45' : ''}`}
          aria-hidden
        >
          +
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          className="px-5 pb-5 text-muted text-sm leading-relaxed border-t border-border"
        >
          <p className="pt-4">{a}</p>
        </div>
      )}
    </div>
  )
}

function CtaBand() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-64 bg-primary/10 blur-3xl pointer-events-none" />
      <div className="max-w-3xl mx-auto px-5 text-center relative">
        <div className="text-6xl mb-6">🥷</div>
        <h2 className="text-4xl md:text-6xl font-black tracking-tight text-balance">
          Stop guessing. Start{' '}
          <span className="text-primary animate-glow">knowing</span>.
        </h2>
        <p className="mt-5 text-lg text-muted max-w-xl mx-auto">
          Free on the App Store. No account needed to try Demo Mode.
        </p>
        <div className="mt-8 flex justify-center">
          <AppStoreBadge />
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-2.5 text-sm text-muted">
          <span className="text-xl">🥷</span>
          <span>© {new Date().getFullYear()} Earnings Ninja. Made for drivers.</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <a href={PRIVACY_URL} className="text-muted hover:text-white transition-colors">Privacy</a>
          <a href={SUPPORT_URL} className="text-muted hover:text-white transition-colors">Support</a>
          <a
            href="mailto:support@earningsninja.app"
            className="text-muted hover:text-white transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  )
}
