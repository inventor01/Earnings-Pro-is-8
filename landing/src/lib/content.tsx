// Central copy + config for the Earnings Ninja marketing site.
// Edit prices / URLs here once and both pages update.

// Flip this to the real App Store URL at launch to turn every "Coming soon"
// button into a live "Download" link automatically.
export const APP_STORE_URL: string | null = null

// Opens the installed app (existing free users land on Settings → Upgrade).
export const APP_DEEP_LINK = 'earningsninja://'

// Where "Try free / get the app" CTAs send users: the App Store once
// APP_STORE_URL is live, otherwise the homepage where the download badge lives.
export const APP_DOWNLOAD_URL: string = APP_STORE_URL ?? '/'

export const PRIVACY_URL = '/privacy'
export const SUPPORT_URL = '/support'
export const SUPPORT_EMAIL = 'support@earningsninja.com'

export const PLATFORMS = ['DoorDash', 'Uber Eats', 'Instacart', 'GrubHub', 'Shipt']

export interface Plan {
  id: 'annual' | 'monthly' | 'lifetime'
  name: string
  price: string
  period: string
  sub: string
  badge?: string
  note?: string
  highlight?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'annual',
    name: 'Annual',
    price: '$29.99',
    period: '/year',
    sub: 'Just $2.50/mo, billed yearly',
    badge: 'BEST VALUE',
    note: 'Save 16% vs monthly',
    highlight: true,
  },
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$2.99',
    period: '/mo',
    sub: 'Cancel anytime, no commitment',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: '$79.99',
    period: ' once',
    sub: 'Pay once. Pro forever.',
    badge: 'NO SUBSCRIPTION',
  },
]

// Benefit-first feature cards for the main landing page.
export const LANDING_FEATURES = [
  {
    icon: '⚡',
    title: 'Log an order in 3 seconds',
    body: 'A calculator-style number pad — tap, tap, save. No keyboard, no clunky forms, no excuses between stops.',
  },
  {
    icon: '📊',
    title: 'See your REAL hourly rate',
    body: '$/hour, $/mile, net profit — every number updates live the second you log an entry. No more guessing.',
  },
  {
    icon: '🎯',
    title: 'Hit goals that pay you back',
    body: 'Set daily, weekly, and monthly profit targets. Watch the bar fill and the ninja glow when you crush them.',
  },
  {
    icon: '📱',
    title: 'Profit on your Lock Screen',
    body: 'Home Screen and Lock Screen widgets show today\u2019s net profit at a glance — tap to jump straight into a new entry.',
  },
  {
    icon: '🤖',
    title: 'AI that finds you money',
    body: 'Smart suggestions surface your best days, zones, and platforms so you stop driving for scraps.',
  },
  {
    icon: '🔒',
    title: 'No ads. No trackers.',
    body: 'We don\u2019t sell your data and we don\u2019t run analytics SDKs. Your earnings are nobody\u2019s business but yours.',
  },
]

// Free vs Pro comparison. `free`/`pro` are true (included) or a string note.
export interface CompareRow {
  feature: string
  free: boolean
  pro: boolean
}

export const COMPARISON: CompareRow[] = [
  { feature: 'Unlimited order & expense logging', free: true, pro: true },
  { feature: 'Real-time net profit & live KPIs', free: true, pro: true },
  { feature: 'Daily / weekly / monthly profit goals', free: true, pro: true },
  { feature: 'Home & Lock Screen widgets', free: true, pro: true },
  { feature: '9 expense categories (incl. Charity & Business)', free: true, pro: true },
  { feature: 'Dark Neon + Light themes', free: true, pro: true },
  { feature: 'GPS trip mileage tracking', free: true, pro: true },
  { feature: 'Advanced Analytics — trends, best days & hours', free: false, pro: true },
  { feature: 'Tax-ready CSV exports', free: false, pro: true },
  { feature: 'AI earning suggestions', free: false, pro: true },
  { feature: 'Automatic platform imports (Uber Eats, Shipt)', free: false, pro: true },
  { feature: 'Priority support', free: false, pro: true },
]

export interface Testimonial {
  quote: string
  name: string
  meta: string
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'I drove 11 hours thinking I crushed it. Earnings Ninja showed me I cleared $94 after gas. Brutal — but now I only take orders that actually pay.',
    name: 'Marcus T.',
    meta: 'DoorDash · Atlanta',
  },
  {
    quote:
      'Tax season used to wreck me. I exported one CSV and my accountant was done in 20 minutes. Worth the $30 by itself.',
    name: 'Priya R.',
    meta: 'Uber Eats · Chicago',
  },
  {
    quote:
      'The $/mile number changed how I drive. I stopped chasing $3 orders 8 miles away and my take-home jumped almost $300 a month.',
    name: 'Devin K.',
    meta: 'Instacart · Phoenix',
  },
]

export interface Faq {
  q: string
  a: string
}

export const FAQS: Faq[] = [
  {
    q: 'Which delivery platforms does it support?',
    a: 'DoorDash, Uber Eats, Instacart, GrubHub, and Shipt — plus an "Other" option for any gig the app doesn\u2019t list by name.',
  },
  {
    q: 'Is there a free version?',
    a: 'Yes. The core tracker — unlimited logging, real-time net profit, KPIs, goals, widgets, and themes — is free forever. Pro ($2.99/mo or $29.99/yr) unlocks Advanced Analytics, tax-ready exports, AI suggestions, and automatic imports.',
  },
  {
    q: 'How is my net profit calculated?',
    a: 'Net profit = revenue (orders + bonuses) minus expenses (gas, tolls, parking, etc.) minus your vehicle cost (miles driven × your cost-per-mile, or the IRS standard rate). It\u2019s the number the gig apps never show you.',
  },
  {
    q: 'How does billing and cancelling work?',
    a: 'Pro is billed securely through your Apple ID. There\u2019s no contract — cancel anytime in two taps from Settings and you keep Pro until the end of the period you paid for.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. No ads, no analytics SDKs, no data sold to third parties. The only outside service that ever sees anything is the email provider that sends password-reset emails. Full details on the Privacy page.',
  },
  {
    q: 'Does the app track my location?',
    a: 'Only when you explicitly start a trip. The GPS trip tracker measures a single delivery\u2019s distance — you choose when to start and stop. Nothing runs in the background, and you can always enter mileage by hand.',
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
