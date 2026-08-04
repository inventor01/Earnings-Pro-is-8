// Central copy + config for the Earnings Ninja marketing site.
// Edit prices / URLs here once and both pages update.

// Flip this to the real App Store URL at launch to turn every "Coming soon"
// button into a live "Download" link automatically.
export const APP_STORE_URL: string | null = 'https://apps.apple.com/us/app/earnings-ninja/id6784464357'

// Opens the installed app (existing free users land on Settings → Upgrade).
export const APP_DEEP_LINK = 'earningsninja://'

// Where "Try free / get the app" CTAs send users: the App Store once
// APP_STORE_URL is live, otherwise the waitlist form on the homepage so every
// conversion intent lands on a concrete action (not a dead loop back home).
export const APP_DOWNLOAD_URL: string = APP_STORE_URL ?? '/#waitlist'

// Prelaunch-safe CTA label: never promise a trial that can't start today.
export const TRIAL_CTA_LABEL = APP_STORE_URL ? 'Try free for 7 days' : 'Get early access'

export const PRIVACY_URL = '/privacy'
export const TERMS_URL = '/terms'
export const SUPPORT_URL = '/support'
export const SUPPORT_EMAIL = 'support@earningsninja.com'

export const PLATFORMS = ['DoorDash', 'Uber Eats', 'Instacart', 'Spark', 'GrubHub', 'Shipt']

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
    icon: '01',
    title: 'See what costs are taking from your pay.',
    body: 'Gas, maintenance, tolls, and the quiet costs of driving stop hiding in the margins.',
  },
  {
    icon: '02',
    title: 'Know what you made across every app.',
    body: 'One combined dashboard for DoorDash, Uber Eats, Instacart, Spark, and the rest of your hustle.',
  },
  {
    icon: '03',
    title: 'Know when you can go home.',
    body: 'Set a target for rent, bills, or savings and see exactly how much further tonight has to go.',
  },
  {
    icon: '04',
    title: 'Find the shifts worth repeating.',
    body: 'Spot the days, hours, and apps that pay you best without building another spreadsheet.',
  },
  {
    icon: '05',
    title: 'Keep cleaner records at tax time.',
    body: 'Your earnings history and expenses stay together, ready when April stops being theoretical.',
  },
  {
    icon: '06',
    title: 'Track your numbers, not somebody else’s.',
    body: 'No ads. No data selling. Just the number you need before you accept the next order.',
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

// Testimonials removed deliberately (Aug 2026): we have no real user quotes
// yet, and fabricated ones destroy trust. Re-add a TESTIMONIALS export here
// with REAL beta-tester quotes once we have them.

export interface Faq {
  q: string
  a: string
}

export const FAQS: Faq[] = [
  {
    q: 'Which delivery platforms does it support?',
    a: 'DoorDash, Uber Eats, Instacart, GrubHub, and Shipt — plus an "Other" option for any gig the app doesn\u2019t list by name. Multi-apping? Log every platform in one place and see which one actually pays you best.',
  },
  {
    q: 'Is there a free version?',
    a: 'Yes. The core tracker — unlimited logging, real-time net profit, KPIs, goals, widgets, and themes — is free forever. Pro ($2.99/mo or $29.99/yr) unlocks Advanced Analytics, tax-ready exports, AI suggestions, and automatic imports.',
  },
  {
    q: 'How is my net profit calculated?',
    a: 'Net profit = what you brought in (orders, tips, Peak Pay, bonuses) minus expenses (gas, tolls, parking, etc.) minus your vehicle cost (miles driven × your cost per mile, or the IRS standard rate). It\u2019s the number the gig apps never show you.',
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
