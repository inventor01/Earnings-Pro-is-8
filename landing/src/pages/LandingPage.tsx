import { useState } from 'react'
import { Link } from '../components/router'
import {
  Nav,
  Footer,
  AppStoreBadge,
  SectionLabel,
  Stat,
  StickyCta,
  ExitIntent,
  useDocumentMeta,
} from '../components/ui'
import {
  PhoneShot,
  SCREENSHOTS,
} from '../components/mockups'
import { LANDING_FEATURES, TESTIMONIALS, FAQS } from '../lib/content'

export default function LandingPage() {
  useDocumentMeta(
    'Earnings Ninja — Stop Guessing What You Actually Make',
    'The only app that shows delivery drivers their TRUE net profit after gas, miles, and expenses. Real-time profit, AI suggestions, tax-ready exports. DoorDash, Uber Eats, Instacart, GrubHub & Shipt.',
  )
  return (
    <div className="min-h-screen text-white">
      <Nav ctaTo="/upgrade" />
      <Hero />
      <TrustBar />
      <Problem />
      <HowItWorks />
      <Screenshots />
      <SocialProof />
      <Features />
      <HonestMath />
      <PricingTeaser />
      <Faq />
      <FinalCta />
      <Footer />
      <StickyCta label="See Pro pricing" to="/upgrade" />
      <ExitIntent />
    </div>
  )
}

/* ------------------------------------------------------------------ */
function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
      <div className="max-w-6xl mx-auto px-5 pt-14 pb-20 md:pt-24 md:pb-28 relative">
        <div className="grid md:grid-cols-2 gap-12 md:gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1 text-xs text-muted mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-slow" />
              Built by a driver, for drivers — iPhone, iOS 17+
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.02] text-balance">
              Stop guessing what you{' '}
              <span className="text-primary animate-glow">actually</span> make.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted max-w-xl text-balance">
              Most apps show your gross and call it a day. Earnings Ninja shows your{' '}
              <span className="text-white font-semibold">real net profit</span> after gas, miles, and
              expenses — in real time, across every platform you drive for.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <AppStoreBadge />
              <Link
                to="/upgrade"
                className="inline-flex items-center gap-2 bg-primary text-black font-bold px-6 py-3.5 rounded-2xl text-base hover:shadow-neon-yellow hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                See Pro — $2.99/mo
                <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-6 text-xs text-muted">
              <Stat value="$2.99" label="Per month for Pro" />
              <Stat value="5" label="Platforms supported" />
              <Stat value="0" label="Ads or trackers" />
            </div>
          </div>
          <div className="relative flex justify-center md:justify-end">
            <div className="absolute -inset-10 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
            <PhoneShot
              src={SCREENSHOTS.dashboardWeek}
              alt="Earnings Ninja dashboard showing $982.06 net profit over the last 7 days"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function TrustBar() {
  return (
    <section className="border-y border-border bg-surface/40">
      <div className="max-w-6xl mx-auto px-5 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted">
        <span className="flex items-center gap-2">
          <span className="text-primary text-base">★★★★★</span> Loved by working drivers
        </span>
        <span className="hidden sm:inline text-border">|</span>
        <span>DoorDash · Uber Eats · Instacart · GrubHub · Shipt</span>
        <span className="hidden sm:inline text-border">|</span>
        <span>🔒 No ads · No data sold</span>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function Problem() {
  const pains = [
    {
      icon: '⛽',
      title: 'Gas eats your "earnings"',
      body: 'That $310 day? After fill-ups it might be $180. The gig apps will never tell you that.',
    },
    {
      icon: '🎰',
      title: 'You take orders that lose money',
      body: 'A $4 order 9 miles away feels like income. It\u2019s a loss once you count the mileage.',
    },
    {
      icon: '🧾',
      title: 'Tax season is a nightmare',
      body: 'No records, no mileage log, no deductions tracked. You overpay or panic every April.',
    },
  ]
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl">
          <SectionLabel>The problem</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            You&rsquo;re working hard. But are you actually getting paid?
          </h2>
          <p className="mt-4 text-muted text-lg">
            If you can&rsquo;t answer &ldquo;what did I really clear last week?&rdquo; in under five seconds, the
            apps are winning and you&rsquo;re guessing.
          </p>
        </div>
        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          {pains.map((p) => (
            <div key={p.title} className="bg-card border border-border rounded-2xl p-6">
              <div className="text-3xl mb-3">{p.icon}</div>
              <div className="font-bold text-lg mb-1.5">{p.title}</div>
              <p className="text-muted text-sm leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function HowItWorks() {
  const steps = [
    {
      n: '1',
      title: 'Log it in 3 seconds',
      body: 'Tap + Add Entry after each order or expense. Or let automatic imports pull them in for you.',
      shot: SCREENSHOTS.dashboardDay,
      alt: 'Daily dashboard with the + Add Entry button',
    },
    {
      n: '2',
      title: 'Watch your real numbers',
      body: 'Net profit, $/hour, and $/mile update live — so you know if a shift is worth it while you\u2019re still out.',
      shot: SCREENSHOTS.topDays,
      alt: 'Top earning days and daily profit breakdown',
    },
    {
      n: '3',
      title: 'Keep more of it',
      body: 'Export tax-ready records, follow AI suggestions, and stop taking the orders that quietly cost you money.',
      shot: SCREENSHOTS.settings,
      alt: 'Settings screen with CSV export and theme options',
    },
  ]
  return (
    <section className="py-20 md:py-28 border-t border-border bg-surface/40">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            Three taps to the truth.
          </h2>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-10 md:gap-6 justify-items-center">
          {steps.map((s) => (
            <div key={s.n} className="flex flex-col items-center text-center">
              <PhoneShot src={s.shot} alt={s.alt} />
              <div className="mt-6 max-w-xs">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-black font-black mb-2">
                  {s.n}
                </div>
                <div className="font-bold text-lg">{s.title}</div>
                <p className="text-sm text-muted mt-1.5 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function Screenshots() {
  const shots = [
    { src: SCREENSHOTS.dashboardWeek, label: 'Weekly net profit' },
    { src: SCREENSHOTS.dashboardDay, label: 'Day-by-day earnings' },
    { src: SCREENSHOTS.topDays, label: 'Top earning days' },
    { src: SCREENSHOTS.analytics, label: 'Peak earning hours' },
    { src: SCREENSHOTS.platforms, label: 'Best-paying platforms' },
    { src: SCREENSHOTS.settings, label: 'CSV export & themes' },
  ]
  return (
    <section id="showcase" className="scroll-smooth-anchor py-20 md:py-28 border-t border-border">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <SectionLabel>Real screenshots</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            This is the actual app.
          </h2>
          <p className="mt-4 text-muted text-lg">
            No mockups — real numbers from real driving, in the neon car-dashboard you&rsquo;ll see every shift.
          </p>
        </div>
        <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 -mx-5 px-5 md:grid md:grid-cols-3 md:gap-x-6 md:gap-y-12 md:overflow-visible md:mx-0 md:px-0">
          {shots.map((s) => (
            <div key={s.label} className="snap-center shrink-0 flex flex-col items-center">
              <PhoneShot src={s.src} alt={s.label} className="w-[220px] sm:w-[250px]" />
              <div className="mt-4 text-sm font-semibold text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function SocialProof() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <SectionLabel>What drivers say</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            Drivers find <span className="text-primary">$150–$400+</span> more a month.
          </h2>
          <p className="mt-4 text-muted text-lg">
            Not by working more — by cutting the orders and costs that were quietly draining them.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="bg-card border border-border rounded-2xl p-6 flex flex-col">
              <div className="text-primary mb-3">★★★★★</div>
              <blockquote className="text-sm text-white/90 leading-relaxed flex-1">“{t.quote}”</blockquote>
              <figcaption className="mt-4 text-xs text-muted">
                <span className="text-white font-semibold">{t.name}</span> — {t.meta}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function Features() {
  return (
    <section id="features" className="scroll-smooth-anchor py-20 md:py-28 border-t border-border bg-surface/40">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl">
          <SectionLabel>Why drivers love it</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            Everything you need. Nothing you don&rsquo;t.
          </h2>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LANDING_FEATURES.map((f) => (
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

/* ------------------------------------------------------------------ */
function HonestMath() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-5xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <SectionLabel>The honest math</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            What the gig apps don&rsquo;t tell you.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-7">
            <div className="text-xs uppercase tracking-wider text-muted mb-3">What DoorDash shows you</div>
            <div className="text-4xl font-black text-white">$310.00</div>
            <div className="text-sm text-muted mt-1">&ldquo;Earnings&rdquo;</div>
            <ul className="mt-6 space-y-2 text-sm text-muted">
              <li>• No gas deducted</li>
              <li>• No parking, no tolls</li>
              <li>• No vehicle depreciation</li>
              <li>• No real hourly rate</li>
            </ul>
          </div>
          <div className="bg-card border border-primary/40 rounded-2xl p-7 shadow-neon-yellow">
            <div className="text-xs uppercase tracking-wider text-primary mb-3">
              What Earnings Ninja shows you
            </div>
            <div
              className="text-4xl font-black text-primary"
              style={{ textShadow: '0 0 16px rgba(250,204,21,0.6)' }}
            >
              $186.40
            </div>
            <div className="text-sm text-muted mt-1">Real net profit · $14.34/hr</div>
            <ul className="mt-6 space-y-2 text-sm text-white/90">
              <li className="flex justify-between">
                <span className="text-muted">Gross</span> <span>$310.00</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted">Gas</span> <span className="text-red">−$45.00</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted">Tolls</span> <span className="text-red">−$3.25</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted">Vehicle (IRS rate)</span>{' '}
                <span className="text-red">−$75.35</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function PricingTeaser() {
  return (
    <section className="py-20 md:py-28 border-t border-border bg-surface/40">
      <div className="max-w-3xl mx-auto px-5 text-center">
        <SectionLabel>Simple pricing</SectionLabel>
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
          Start free. Go Pro for the price of one bad order.
        </h2>
        <p className="mt-4 text-muted text-lg">
          The core tracker is free forever. Pro unlocks analytics, tax exports, AI suggestions, and
          automatic imports for <span className="text-white font-semibold">$2.99/mo</span> — or{' '}
          <span className="text-white font-semibold">$29.99/yr</span> (2 months free).
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/upgrade"
            className="inline-flex items-center gap-2 bg-primary text-black font-bold px-8 py-4 rounded-2xl text-base hover:shadow-neon-yellow hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Compare Free vs Pro
            <span aria-hidden>→</span>
          </Link>
          <AppStoreBadge />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function Faq() {
  return (
    <section id="faq" className="scroll-smooth-anchor py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-5">
        <div className="text-center mb-12">
          <SectionLabel>Questions</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Frequently asked.</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((it) => (
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
        <div id={panelId} role="region" className="px-5 pb-5 text-muted text-sm leading-relaxed border-t border-border">
          <p className="pt-4">{a}</p>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
function FinalCta() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden border-t border-border">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-64 bg-primary/10 blur-3xl pointer-events-none" />
      <div className="max-w-3xl mx-auto px-5 text-center relative">
        <div className="text-6xl mb-6">🥷</div>
        <h2 className="text-4xl md:text-6xl font-black tracking-tight text-balance">
          Stop guessing. Start <span className="text-primary animate-glow">knowing</span>.
        </h2>
        <p className="mt-5 text-lg text-muted max-w-xl mx-auto">
          Free to start. Pro is $2.99/mo and pays for itself the first time you skip a money-losing order.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
          <AppStoreBadge />
          <Link
            to="/upgrade"
            className="inline-flex items-center gap-2 bg-primary text-black font-bold px-8 py-4 rounded-2xl text-base hover:shadow-neon-yellow hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            See Pro pricing
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
