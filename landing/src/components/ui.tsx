import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from './router'
import {
  APP_STORE_URL,
  APP_DOWNLOAD_URL,
  TRIAL_CTA_LABEL,
  PRIVACY_URL,
  TERMS_URL,
  SUPPORT_URL,
  SUPPORT_EMAIL,
} from '../lib/content'
import logoBadge from '../assets/logo-badge.webp'
import logoFull from '../assets/logo-full.webp'

/* ------------------------------------------------------------------ */
/* SEO: per-page <title> + meta description                            */
/* ------------------------------------------------------------------ */
export function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title
    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector)
      if (!el) {
        el = document.createElement('meta')
        const [k, v] = attr.split('=')
        el.setAttribute(k, v.replace(/"/g, ''))
        document.head.appendChild(el)
      }
      el.setAttribute('content', value)
    }
    setMeta('meta[name="description"]', 'name="description"', description)
    setMeta('meta[property="og:title"]', 'property="og:title"', title)
    setMeta('meta[property="og:description"]', 'property="og:description"', description)
  }, [title, description])
}

/* ------------------------------------------------------------------ */
/* Small primitives                                                    */
/* ------------------------------------------------------------------ */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs uppercase tracking-[0.25em] text-primary font-bold mb-3">{children}</div>
  )
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-extrabold text-white">{value}</div>
      <div className="uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-green" aria-hidden>
      <path d="M8.143 13.314 4.83 10l-1.114 1.106 4.428 4.428 9.428-9.428L16.457 5z" />
    </svg>
  )
}

export function CrossIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-muted/60" aria-hidden>
      <path d="M15 5.41 13.59 4 10 7.59 6.41 4 5 5.41 8.59 9 5 12.59 6.41 14 10 10.41 13.59 14 15 12.59 11.41 9z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* App Store badge (auto "coming soon" until APP_STORE_URL is set)     */
/* ------------------------------------------------------------------ */
export function AppStoreBadge() {
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
        <div className="text-xl font-semibold text-white">{comingSoon ? 'Coming soon' : 'App Store'}</div>
      </div>
    </Wrapper>
  )
}

/* ------------------------------------------------------------------ */
/* Waitlist ("Notify me at launch") email form                         */
/* Posts to the live backend waitlist endpoint (same-origin /api).     */
/* ------------------------------------------------------------------ */
export function WaitlistForm({ source = 'landing', className = '' }: { source?: string; className?: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    try {
      const res = await fetch('/api/waitlist/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), referral_source: source }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className={`bg-card border border-primary/40 rounded-2xl px-5 py-4 text-sm ${className}`} role="status">
        <span className="text-primary font-bold">You&rsquo;re on the list!</span>{' '}
        <span className="text-muted">We&rsquo;ll email you the moment Earnings Ninja hits the App Store.</span>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={`w-full max-w-md ${className}`}>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="flex-1 bg-card border border-border rounded-2xl px-5 py-3.5 text-base text-white placeholder:text-muted focus:outline-none focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="inline-flex items-center justify-center gap-2 bg-primary text-black font-bold px-6 py-3.5 rounded-2xl text-base hover:shadow-neon-primary hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:hover:scale-100 whitespace-nowrap"
        >
          {state === 'sending' ? 'Joining…' : 'Notify me at launch'}
        </button>
      </div>
      {state === 'error' && (
        <p className="mt-2 text-sm text-red" role="alert">
          Something went wrong — please try again, or email {SUPPORT_EMAIL}.
        </p>
      )}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Reusable CTA buttons                                                */
/* ------------------------------------------------------------------ */
export function UpgradeButton({
  label = TRIAL_CTA_LABEL,
  className = '',
}: {
  label?: string
  className?: string
}) {
  return (
    <Link
      to={APP_DOWNLOAD_URL}
      className={`inline-flex items-center justify-center gap-2 bg-primary text-black font-bold px-7 py-3.5 rounded-xl text-base hover:shadow-neon-primary hover:scale-[1.02] active:scale-[0.98] transition-all ${className}`}
    >
      {label}
      <span aria-hidden>→</span>
    </Link>
  )
}

export function GhostButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 border border-border bg-card text-white font-semibold px-7 py-3.5 rounded-xl text-base hover:border-primary/40 transition-all"
    >
      {children}
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */
export function Nav({ ctaTo = '/upgrade' }: { ctaTo?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
    <header className="site-nav fixed top-0 inset-x-0 z-50 bg-bg/95 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img src={logoBadge} alt="Earnings Ninja logo" className="h-9 w-9 object-contain" />
          <span className="font-extrabold tracking-tight text-lg group-hover:text-primary transition-colors">
            Earnings Ninja
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted">
          <Link to="/#features" className="hover:text-white transition-colors">
            Features
          </Link>
          <Link to="/#calculator" className="hover:text-white transition-colors">
            Calculator
          </Link>
          <Link to="/upgrade" className="hover:text-white transition-colors">
            Pricing
          </Link>
          <Link to="/#faq" className="hover:text-white transition-colors">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to={ctaTo}
            className="hidden sm:inline-flex items-center gap-2 bg-primary text-black font-semibold px-4 py-2 rounded-xl text-sm hover:shadow-neon-primary hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {ctaTo === '/#waitlist'
              ? 'Get early access'
              : ctaTo === '/upgrade'
                ? 'Try free'
                : APP_STORE_URL
                  ? 'Download'
                  : 'Coming soon'}
          </Link>
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
            <Link to="/#features" onClick={() => setOpen(false)} className="text-muted hover:text-white">
              Features
            </Link>
            <Link to="/#calculator" onClick={() => setOpen(false)} className="text-muted hover:text-white">
              Calculator
            </Link>
            <Link to="/upgrade" onClick={() => setOpen(false)} className="text-muted hover:text-white">
              Pricing
            </Link>
            <Link to="/#faq" onClick={() => setOpen(false)} className="text-muted hover:text-white">
              FAQ
            </Link>
            <a href={SUPPORT_URL} onClick={() => setOpen(false)} className="text-muted hover:text-white">
              Support
            </a>
          </div>
        </div>
      )}
    </header>
      <div aria-hidden className="h-[61px]" />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */
export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-2.5 text-sm text-muted">
          <img src={logoBadge} alt="" className="h-7 w-7 object-contain" />
          <span>© {new Date().getFullYear()} Earnings Ninja. Made for drivers.</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Link to="/upgrade" className="text-muted hover:text-white transition-colors">
            Pricing
          </Link>
          <a href={PRIVACY_URL} className="text-muted hover:text-white transition-colors">
            Privacy
          </a>
          <a href={TERMS_URL} className="text-muted hover:text-white transition-colors">
            Terms
          </a>
          <a href={SUPPORT_URL} className="text-muted hover:text-white transition-colors">
            Support
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-muted hover:text-white transition-colors">
            Contact
          </a>
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/* Sticky mobile CTA bar (appears after scrolling past the hero)       */
/* ------------------------------------------------------------------ */
export function StickyCta({
  label,
  to,
  external,
}: {
  label: string
  to: string
  external?: boolean
}) {
  const [scrolled, setScrolled] = useState(false)
  const [ctaInView, setCtaInView] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 560)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Hide the sticky bar whenever any inline CTA button is visible on screen,
  // so we never stack two "Try free" buttons on top of each other.
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll('[data-cta]'))
    if (targets.length === 0) return
    const visible = new Set<Element>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target)
          else visible.delete(e.target)
        }
        setCtaInView(visible.size > 0)
      },
      { threshold: 0.1 },
    )
    targets.forEach((t) => observer.observe(t))
    return () => observer.disconnect()
  }, [])

  const show = scrolled && !ctaInView

  return (
    <div
      className={`sm:hidden fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pt-3 bg-gradient-to-t from-bg via-bg/95 to-transparent transition-all duration-300 ${
        show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      {external ? (
        <a
          href={to}
          className="flex items-center justify-center gap-2 bg-primary text-black font-bold py-4 rounded-2xl text-base shadow-neon-primary active:scale-[0.98] transition-transform"
        >
          {label}
          <span aria-hidden>→</span>
        </a>
      ) : (
        <Link
          to={to}
          className="flex items-center justify-center gap-2 bg-primary text-black font-bold py-4 rounded-2xl text-base shadow-neon-primary active:scale-[0.98] transition-transform"
        >
          {label}
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Exit-intent modal (desktop only, once per session)                  */
/* ------------------------------------------------------------------ */
export function ExitIntent() {
  const [open, setOpen] = useState(false)
  const fired = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('en_exit_shown')) return
    if (window.matchMedia('(max-width: 768px)').matches) return

    const onLeave = (e: MouseEvent) => {
      if (fired.current) return
      if (e.clientY <= 0) {
        fired.current = true
        sessionStorage.setItem('en_exit_shown', '1')
        setOpen(true)
      }
    }
    document.addEventListener('mouseout', onLeave)
    return () => document.removeEventListener('mouseout', onLeave)
  }, [])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-black/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative max-w-md w-full bg-card border border-primary/40 rounded-3xl p-8 text-center shadow-neon-primary"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute top-4 right-4 text-muted hover:text-white text-xl"
        >
          ✕
        </button>
        <img src={logoFull} alt="Earnings Ninja" className="h-24 w-auto mx-auto mb-4" />
        <h3 className="text-2xl font-black tracking-tight">Before you go…</h3>
        <p className="mt-3 text-muted">
          The gig apps show revenue — not what you actually keep after gas and miles. Get your real
          numbers the day we launch.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            to="/#waitlist"
            onClick={() => setOpen(false)}
            className="bg-primary text-black font-bold py-3.5 rounded-xl hover:shadow-neon-primary transition-all"
          >
            Get early access →
          </Link>
          <button onClick={() => setOpen(false)} className="text-sm text-muted hover:text-white">
            No thanks, I like guessing
          </button>
        </div>
      </div>
    </div>
  )
}
