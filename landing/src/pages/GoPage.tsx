import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import logoBadge from '../assets/logo-badge.webp'

type Screen = 'choose' | 'android' | 'done'
type Device = 'ios' | 'android' | 'desktop'
type Attribution = { source?: string; videoId?: string; formatId?: string; campaignId?: string }

const IOS_URL = 'https://apps.apple.com/us/app/earnings-ninja-gig-tracker/id6784464357'
const TEST_URL = 'https://play.google.com/apps/testing/com.earningsninja.app'
const PLATFORMS = ['DoorDash', 'Uber Eats', 'Instacart', 'Spark', 'GrubHub', 'Shipt', 'Other']

function detectDevice(): Device {
  const ua = navigator.userAgent || ''
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua) || touchMac) return 'ios'
  return 'desktop'
}

function readAttribution(): Attribution {
  const q = new URLSearchParams(location.search)
  const clean = (v: string | null) => v?.trim().slice(0, 100) || undefined
  return {
    source: clean(q.get('src') || q.get('utm_source')),
    videoId: clean(q.get('vid') || q.get('video')),
    formatId: clean(q.get('fmt') || q.get('format')),
    campaignId: clean(q.get('campaign') || q.get('utm_campaign')),
  }
}

async function track(eventType: string, device: Device, a: Attribution) {
  try {
    await fetch('/api/waitlist/event', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ event_type: eventType, device, source: a.source, video_id: a.videoId, format_id: a.formatId, campaign_id: a.campaignId }),
    })
  } catch { /* analytics never blocks conversion */ }
}

export default function GoPage() {
  const [screen, setScreen] = useState<Screen>('choose')
  const [device] = useState<Device>(() => detectDevice())
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [consent, setConsent] = useState(false)
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const attribution = useMemo(readAttribution, [])

  const normalizedEmail = email.trim()
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  const domain = (normalizedEmail.split('@')[1] || '').toLowerCase()
  const gmailWarn = validEmail && !['gmail.com', 'googlemail.com'].includes(domain)

  useEffect(() => {
    const key = `en_go_view:${location.search}`
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      void track('landing_view', device, attribution)
    }
  }, [device, attribution])

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setTried(true); setError('')
    if (!validEmail || !consent || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/waitlist/android-beta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail, first_name: name.trim() || undefined, platforms, consent,
          source: attribution.source, video_id: attribution.videoId, format_id: attribution.formatId, campaign_id: attribution.campaignId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.detail || 'We could not save your request. Please try again.')
      void track('android_beta_submitted', device, attribution)
      setScreen('done'); window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not save your request. Please try again.')
    } finally { setSending(false) }
  }

  const pageUrl = useMemo(() => {
    const q = new URLSearchParams()
    if (attribution.source) q.set('src', attribution.source)
    if (attribution.videoId) q.set('vid', attribution.videoId)
    if (attribution.formatId) q.set('fmt', attribution.formatId)
    if (attribution.campaignId) q.set('campaign', attribution.campaignId)
    const query = q.toString()
    return `https://earningsninja.com/go${query ? `?${query}` : ''}`
  }, [attribution])
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&color=15120f&bgcolor=ece6da&data=${encodeURIComponent(pageUrl)}`

  const chooseCard = 'w-full min-h-28 rounded-[20px] border px-6 py-7 flex items-center justify-between gap-4 text-left no-underline'
  const primary = 'bg-[#f5c518] border-[#f5c518] text-[#15120f]'
  const secondary = 'bg-[#1e1a16] border-[#3a332b] text-[#ece6da]'

  return <div className="min-h-screen bg-[#15120f] text-[#ece6da] px-5 pt-6 pb-12 flex justify-center">
    <div className="w-full max-w-[460px] flex flex-col gap-10">
      <header className="min-h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3.5 text-[#ece6da] no-underline" aria-label="Earnings Ninja home">
          <span className="w-16 h-16 rounded-full overflow-hidden bg-[#a6df86] relative shrink-0"><img src={logoBadge} alt="" className="absolute w-[76px] -left-1.5 top-0" /></span>
          <span className="font-extrabold text-xl">Earnings Ninja</span>
        </a>
        {screen === 'android' && <button onClick={() => setScreen('choose')} className="bg-transparent border-0 text-[#a39a8b] font-semibold text-[15px] cursor-pointer">Back</button>}
      </header>

      {screen === 'choose' && <main className="flex flex-col gap-10 pt-6">
        <div className="flex flex-col gap-4"><h1 className="font-[Manrope] m-0 text-[clamp(40px,10vw,52px)] leading-[1.02] font-extrabold tracking-[-.035em]">Know what you actually made.</h1><p className="m-0 text-lg leading-relaxed text-[#a39a8b]">Track your gig earnings, expenses, mileage and real profit in one place.</p></div>
        <div className="flex flex-col gap-3.5">
          <a href={IOS_URL} onClick={() => { void track('device_ios_selected', device, attribution); void track('ios_app_store_clicked', device, attribution) }} className={`${chooseCard} ${device !== 'android' ? primary : secondary}`}>
            <span className="flex flex-col gap-1">{device === 'ios' && <span className="mono text-[11px] uppercase tracking-[.1em] opacity-70">Your phone</span>}<span className="text-[28px] font-extrabold tracking-[-.02em]">I use iPhone</span><span className="text-[15px] font-semibold opacity-75">Open the App Store</span></span><span className="text-3xl font-bold">→</span>
          </a>
          <button onClick={() => { void track('device_android_selected', device, attribution); setScreen('android'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className={`${chooseCard} ${device === 'android' ? primary : secondary}`}>
            <span className="flex flex-col gap-1">{device === 'android' && <span className="mono text-[11px] uppercase tracking-[.1em] opacity-70">Your phone</span>}<span className="text-[28px] font-extrabold tracking-[-.02em]">I use Android</span><span className="text-[15px] font-semibold opacity-75">Join the closed beta</span></span><span className="text-3xl font-bold">→</span>
          </button>
        </div>
        {device === 'desktop' && <div className="flex gap-5 items-center bg-[#1e1a16] border border-[#2a2520] rounded-[20px] p-5"><img src={qr} alt="QR code for earningsninja.com/go" className="w-28 h-28 rounded-[10px] bg-[#ece6da] p-2 shrink-0" /><div><div className="font-bold mb-1.5">On a computer?</div><div className="text-sm leading-relaxed text-[#a39a8b]">Scan this with your phone camera to open the same campaign link.</div></div></div>}
        <div className="mono text-xs uppercase tracking-[.08em] text-[#6f675b] text-center">No ads · We do not sell your personal data</div>
      </main>}

      {screen === 'android' && <form onSubmit={submit} noValidate className="flex flex-col gap-7">
        <div className="flex flex-col gap-3.5"><span className="mono text-xs uppercase tracking-[.12em] text-[#f5c518]">Android closed beta</span><h1 className="font-[Manrope] m-0 text-[34px] leading-[1.1] font-extrabold tracking-[-.03em]">Get early access on Android</h1><p className="m-0 text-base leading-relaxed text-[#a39a8b]">Our current Google Play closed test is restricted to approved Google accounts. Enter the exact Google account you use in the Play Store. After we add you, we’ll email the opt-in link and instructions.</p></div>
        <label className="flex flex-col gap-2"><span className="text-[15px] font-bold">Google Play email</span><input type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com" aria-invalid={tried && !validEmail} className={`bg-[#1e1a16] border rounded-[14px] p-4 text-[#ece6da] text-[17px] outline-none min-h-14 ${tried && !validEmail ? 'border-[#f07a6a]' : 'border-[#3a332b]'}`} />{tried && !validEmail && <span role="alert" className="text-sm text-[#f07a6a]">Enter a valid email for your Google account.</span>}{gmailWarn && <span className="text-sm leading-relaxed text-[#f5c518] bg-[#2a2312] rounded-[10px] px-3 py-2.5">This is not a Gmail address. That can still be valid, but it must exactly match the Google account signed into your Play Store.</span>}<span className="text-[13px] text-[#6f675b]">Find it in Play Store → profile icon. It must match exactly.</span></label>
        <label className="flex flex-col gap-2"><span className="text-[15px] font-bold">First name <span className="font-medium text-[#6f675b]">· optional</span></span><input type="text" autoComplete="given-name" maxLength={80} value={name} onChange={e => setName(e.target.value)} className="bg-[#1e1a16] border border-[#3a332b] rounded-[14px] p-4 text-[#ece6da] text-[17px] outline-none min-h-14" /></label>
        <div className="flex flex-col gap-2.5"><span className="text-[15px] font-bold">Which apps do you drive for? <span className="font-medium text-[#6f675b]">· optional</span></span><div className="flex flex-wrap gap-2">{PLATFORMS.map(p => { const on = platforms.includes(p); return <button key={p} type="button" aria-pressed={on} onClick={() => setPlatforms(v => on ? v.filter(x => x !== p) : [...v, p])} className={`min-h-11 px-4 rounded-full border text-[15px] font-semibold ${on ? 'bg-[#f5c518] border-[#f5c518] text-[#15120f]' : 'bg-transparent border-[#3a332b] text-[#cfc7b8]'}`}>{p}</button> })}</div></div>
        <label className="flex gap-3.5 items-start cursor-pointer"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="w-6 h-6 mt-px shrink-0 accent-[#f5c518]" /><span className="text-[15px] leading-relaxed text-[#cfc7b8]">Email me about the Android beta, including my tester opt-in link and test updates. Nothing else.</span></label>
        {tried && !consent && <span role="alert" className="text-sm text-[#f07a6a] -mt-4">We need permission to send your tester link.</span>}
        {error && <div role="alert" className="bg-[#351b17] border border-[#71372d] text-[#f3a296] px-3.5 py-3 rounded-xl text-sm leading-relaxed">{error}</div>}
        <button type="submit" disabled={sending} className="min-h-[60px] border-0 rounded-2xl bg-[#f5c518] text-[#15120f] text-lg font-extrabold disabled:opacity-60">{sending ? 'Sending…' : 'Request beta access'}</button>
        <span className="text-[13px] leading-relaxed text-[#6f675b] text-center">We only use this information to run the Android test. <a href="/privacy" className="text-[#f5c518]">Privacy</a></span>
      </form>}

      {screen === 'done' && <main className="flex flex-col gap-8">
        <div className="flex flex-col gap-3.5"><span className="w-[52px] h-[52px] rounded-full bg-[#1f3a2a] text-[#3ccf78] flex items-center justify-center text-2xl font-extrabold">✓</span><h1 className="font-[Manrope] m-0 text-[34px] leading-[1.1] font-extrabold tracking-[-.03em]">{name.trim() ? `You're on the list, ${name.trim()}.` : `You're on the list.`}</h1><p className="m-0 text-base leading-relaxed text-[#a39a8b]">We saved <strong className="text-[#ece6da]">{normalizedEmail}</strong>. Watch for an email after your Google account is added to the closed test.</p></div>
        <div className="flex flex-col gap-3">{[
          ['01','We add your Google account','Your email is placed in our Google Play tester list.'],
          ['02','Watch for your opt-in link','We’ll email the Google Play testing link once your account is approved.'],
          ['03','Opt in on your Android phone','Open the link while signed into the same Google account, then choose “Become a tester”.'],
          ['04','Install and use the beta','Install from Google Play and test the normal Earnings Ninja flows.'],
          ['05','Stay opted in for at least 14 days','Google counts continuous participation. Please remain opted in and send us any bugs or feedback you find.'],
        ].map(([n,t,b]) => <div key={n} className="grid grid-cols-[42px_1fr] gap-3.5 bg-[#1e1a16] border border-[#2a2520] rounded-[14px] px-[18px] py-4"><span className="mono text-[#f5c518] text-[13px] pt-0.5">{n}</span><div><div className="font-extrabold mb-1">{t}</div><div className="text-[#a39a8b] text-sm leading-relaxed">{b}</div></div></div>)}</div>
        <div className="bg-[#1e1a16] border border-[#2a2520] rounded-[14px] px-[18px] py-4 text-sm leading-relaxed text-[#a39a8b]">After you are added, you can also use the official <a href={TEST_URL} className="text-[#f5c518]">Google Play testing page</a>.</div>
        <button onClick={() => { setScreen('choose'); setTried(false); setError('') }} className="min-h-[52px] bg-transparent border border-[#3a332b] rounded-[14px] text-[#ece6da] text-base font-semibold">Use a different email</button>
      </main>}
    </div>
  </div>
}
