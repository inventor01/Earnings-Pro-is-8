import { Link } from '../components/router'
import {
  Nav,
  Footer,
  SectionLabel,
  StickyCta,
  UpgradeButton,
  CheckIcon,
  CrossIcon,
  useDocumentMeta,
} from '../components/ui'
import { PhoneShot, SCREENSHOTS } from '../components/mockups'
import logoFull from '../assets/logo-full.webp'
import { PLANS, COMPARISON, TESTIMONIALS, APP_DEEP_LINK } from '../lib/content'

export default function UpgradePage() {
  useDocumentMeta(
    'Try Earnings Ninja Pro free for 7 days — then $2.99/mo',
    'Try every Pro feature free for 7 days: Advanced Analytics, tax-ready exports, AI earning suggestions, and automatic platform imports. Then just $2.99/month or $29.99/year. Cancel anytime.',
  )
  return (
    <div className="min-h-screen text-white">
      <Nav ctaTo="/upgrade" />
      <Hero />
      <Problem />
      <ProValue />
      <Pricing />
      <Comparison />
      <Testimonials />
      <Guarantee />
      <FinalCta />
      <Footer />
      <StickyCta label="Try free for 7 days" to={APP_DEEP_LINK} external />
    </div>
  )
}

/* ------------------------------------------------------------------ */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
      <div className="max-w-6xl mx-auto px-5 pt-14 pb-16 md:pt-24 md:pb-20 relative">
        <div className="grid md:grid-cols-2 gap-12 md:gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/40 rounded-full px-3 py-1 text-xs text-primary font-semibold mb-6">
              ⚡ 7 days free — then $2.99/mo
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.04] text-balance">
              You drive hard. <span className="text-primary animate-glow">Now take home more.</span>
            </h1>
            <p className="mt-6 text-lg text-muted max-w-xl text-balance">
              Free shows you the truth. Pro turns it into a raise — the orders to skip, every mile written off at
              tax time, and AI that points you straight at the money. Try every Pro feature{' '}
              <span className="text-white font-semibold">free for 7 days</span> — you won&rsquo;t pay a cent until day 8.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <UpgradeButton label="Try free for 7 days" />
              <Link to="#pricing" className="text-sm text-muted hover:text-white inline-flex items-center gap-1.5">
                See all plans <span aria-hidden>↓</span>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted">
              7 days free, then $2.99/mo or $29.99/yr. Cancel anytime in two taps — no contract.
            </p>
          </div>
          <div className="relative flex justify-center md:justify-end">
            <div className="absolute -inset-10 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
            <PhoneShot
              src={SCREENSHOTS.dashboardWeek}
              alt="Earnings Ninja dashboard — weekly net profit at a glance"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function Problem() {
  const pains = [
    {
      icon: '💸',
      body: 'The apps brag about your “earnings.” Not one of them subtracts your gas.',
    },
    {
      icon: '🛻',
      body: 'You take orders that lose money 8 miles out — and never even know it.',
    },
    {
      icon: '🧾',
      body: 'Tax season hits and your write-offs are a shoebox full of guesses.',
    },
  ]
  return (
    <section className="py-16 md:py-24 border-t border-border bg-surface/40">
      <div className="max-w-5xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <SectionLabel>Sound familiar?</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            Busy all day — so where did the money go?
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {pains.map((p) => (
            <div key={p.body} className="bg-card border border-border rounded-2xl p-6">
              <div className="text-3xl mb-3">{p.icon}</div>
              <p className="text-white/90 text-sm leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-lg text-muted text-balance max-w-xl mx-auto">
          You&rsquo;re not lazy. You&rsquo;re flying blind.{' '}
          <span className="text-white font-semibold">Pro fixes that.</span>
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function ProValue() {
  const items = [
    {
      icon: '📈',
      title: 'Advanced Analytics',
      body: 'Your best days, hours, and zones at a glance. Do more of what pays — less of what doesn\u2019t.',
    },
    {
      icon: '🧾',
      title: 'Tax-ready exports',
      body: 'One tap turns every mile and entry into a clean CSV. Hand it over and stop tipping the IRS.',
    },
    {
      icon: '🤖',
      title: 'AI earning suggestions',
      body: 'Personal tips that point you at the money — and flag the orders quietly draining your tank.',
    },
    {
      icon: '🔄',
      title: 'Automatic imports',
      body: 'Link Uber Eats and Shipt and your orders log themselves. Less typing, more driving.',
    },
  ]
  return (
    <section className="py-16 md:py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <SectionLabel>Here&rsquo;s the fix</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            Everything Pro unlocks pays for itself.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((it) => (
            <div key={it.title} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-all">
              <div className="text-3xl mb-3">{it.icon}</div>
              <div className="font-bold text-lg mb-1.5">{it.title}</div>
              <p className="text-muted text-sm leading-relaxed">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function Pricing() {
  return (
    <section id="pricing" className="scroll-smooth-anchor py-20 md:py-28">
      <div className="max-w-5xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <SectionLabel>Start free</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            Try it free. Decide in a week.
          </h2>
          <p className="mt-4 text-muted text-lg">
            Subscriptions start with 7 days free — keep it for less than a coffee, or cancel and pay nothing. Prefer
            to own it outright? Grab Lifetime. No tiers, no upsells — every plan unlocks everything.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4 items-stretch">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-3xl p-7 border ${
                plan.highlight
                  ? 'bg-card border-primary/50 shadow-neon-primary md:scale-[1.03]'
                  : 'bg-card border-border'
              }`}
            >
              {plan.badge && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                    plan.highlight ? 'bg-primary text-black' : 'bg-border text-white'
                  }`}
                >
                  {plan.badge}
                </div>
              )}
              <div className="text-sm uppercase tracking-wider text-muted">{plan.name}</div>
              <div className="mt-2 flex items-end gap-1">
                <span
                  className="text-4xl font-black text-white"
                  style={plan.highlight ? { textShadow: '0 0 16px rgba(163,230,53,0.4)' } : undefined}
                >
                  {plan.price}
                </span>
                <span className="text-muted mb-1 text-sm">{plan.period}</span>
              </div>
              <div className="text-sm text-muted mt-1">{plan.sub}</div>
              {plan.note && <div className="mt-2 text-xs font-semibold text-green">{plan.note}</div>}
              <div className="flex-1" />
              <a
                href={APP_DEEP_LINK}
                className={`mt-6 inline-flex items-center justify-center gap-2 font-bold px-6 py-3.5 rounded-xl text-base transition-all ${
                  plan.highlight
                    ? 'bg-primary text-black hover:shadow-neon-primary hover:scale-[1.02] active:scale-[0.98]'
                    : 'border border-border text-white hover:border-primary/40'
                }`}
              >
                Choose {plan.name}
              </a>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted mt-6">
          Tap a plan to open Earnings Ninja and start your free trial, then confirm in Settings → Upgrade to Pro.
          Subscriptions begin with 7 days free — you won&rsquo;t be charged until day 8. Billed securely through your
          Apple ID.
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function Comparison() {
  return (
    <section className="py-20 md:py-28 border-t border-border bg-surface/40">
      <div className="max-w-3xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <SectionLabel>Free vs Pro</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            Exactly what your free trial unlocks.
          </h2>
        </div>
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 sm:gap-x-8 px-5 sm:px-7 py-4 border-b border-border bg-surface/60">
            <div className="text-xs uppercase tracking-wider text-muted">Feature</div>
            <div className="text-xs uppercase tracking-wider text-muted text-center w-12">Free</div>
            <div className="text-xs uppercase tracking-wider text-primary font-bold text-center w-12">Pro</div>
          </div>
          {COMPARISON.map((row) => (
            <div
              key={row.feature}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 sm:gap-x-8 px-5 sm:px-7 py-3.5 border-b border-border/60 last:border-0"
            >
              <div className="text-sm text-white/90 pr-2">{row.feature}</div>
              <div className="flex justify-center w-12">{row.free ? <CheckIcon /> : <CrossIcon />}</div>
              <div className="flex justify-center w-12">{row.pro ? <CheckIcon /> : <CrossIcon />}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <UpgradeButton label="Try free for 7 days" />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function Testimonials() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <SectionLabel>Drivers on Pro</SectionLabel>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-balance">
            It pays for itself in one shift.
          </h2>
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
function Guarantee() {
  return (
    <section className="py-16 md:py-20 border-t border-border bg-surface/40">
      <div className="max-w-3xl mx-auto px-5">
        <div className="bg-card border border-primary/30 rounded-3xl p-8 text-center">
          <div className="text-5xl mb-4">🛡️</div>
          <h3 className="text-2xl md:text-3xl font-black tracking-tight">7 days free. Then cancel in two taps.</h3>
          <p className="mt-4 text-muted">
            Use every Pro feature free for a week. Love it? Do nothing — it&rsquo;s just $2.99/mo or $29.99/yr. Not
            for you? Cancel before day 7 from Settings and pay exactly $0. No contract, no lock-in, no hard feelings.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/90">
            <span className="flex items-center gap-2">
              <CheckIcon /> Pay nothing for 7 days
            </span>
            <span className="flex items-center gap-2">
              <CheckIcon /> Cancel anytime
            </span>
            <span className="flex items-center gap-2">
              <CheckIcon /> No ads, ever
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
function FinalCta() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden border-t border-border">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-64 bg-primary/10 blur-3xl pointer-events-none" />
      <div className="max-w-3xl mx-auto px-5 text-center relative">
        <img src={logoFull} alt="Earnings Ninja" className="h-28 w-auto mx-auto mb-6" />
        <h2 className="text-4xl md:text-6xl font-black tracking-tight text-balance">
          Your money&rsquo;s out there. <span className="text-primary animate-glow">Go take it.</span>
        </h2>
        <p className="mt-5 text-lg text-muted max-w-xl mx-auto">
          7 days free, then $2.99/mo or $29.99/yr. The first money-losing order you skip pays for the whole year.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
          <UpgradeButton label="Try free for 7 days" />
          <Link
            to="/#faq"
            className="inline-flex items-center gap-2 border border-border bg-card text-white font-semibold px-8 py-4 rounded-2xl text-base hover:border-primary/40 transition-all"
          >
            Read the FAQ <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
