import type { ReactNode } from 'react'

export function PhoneMockup({ children }: { children: ReactNode }) {
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

export function DashboardPreview() {
  return (
    <div className="h-full w-full flex flex-col pt-9 px-3.5 pb-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[9px] tracking-[0.25em] text-primary font-bold">EARNINGS NINJA</span>
        <span className="text-[9px] text-muted">TODAY</span>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-2.5">
        <div className="text-[9px] uppercase tracking-wider text-muted">Net Profit</div>
        <div
          className="text-3xl font-black text-primary mt-0.5"
          style={{ textShadow: '0 0 14px rgba(250,204,21,0.55)' }}
        >
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

export function CalculatorPreview() {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']
  return (
    <div className="h-full w-full flex flex-col pt-9 px-3.5 pb-3.5">
      <div className="text-[9px] tracking-[0.25em] text-primary font-bold mb-2">ADD ENTRY</div>
      <div className="bg-card border border-border rounded-2xl p-4 mb-2.5 text-center">
        <div className="text-[9px] uppercase tracking-wider text-muted">Amount</div>
        <div
          className="text-4xl font-black text-primary mt-1"
          style={{ textShadow: '0 0 14px rgba(250,204,21,0.55)' }}
        >
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

export function AnalyticsPreview() {
  const bars = [40, 62, 48, 80, 55, 95, 70]
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <div className="h-full w-full flex flex-col pt-9 px-3.5 pb-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[9px] tracking-[0.25em] text-primary font-bold">ANALYTICS</span>
        <span className="text-[9px] text-muted">THIS WEEK</span>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-2.5">
        <div className="text-[9px] uppercase tracking-wider text-muted">Net this week</div>
        <div
          className="text-3xl font-black text-primary mt-0.5"
          style={{ textShadow: '0 0 14px rgba(250,204,21,0.55)' }}
        >
          $1,284.60
        </div>
        <div className="flex items-end justify-between gap-1.5 mt-4 h-24">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-green to-primary"
                style={{ height: `${h}%`, boxShadow: '0 0 6px rgba(250,204,21,0.4)' }}
              />
              <span className="text-[7px] text-muted">{days[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <MiniKpi label="Best day" value="Sat" />
        <MiniKpi label="Best $/hr" value="$31.20" />
      </div>

      <div className="bg-card border border-primary/40 rounded-2xl p-3 flex-1 min-h-0">
        <div className="text-[9px] uppercase tracking-wider text-primary mb-1.5">🤖 AI Suggestion</div>
        <p className="text-[10px] text-white/90 leading-relaxed">
          Your best hours are Fri–Sat 5–9pm. Skipping orders under $1.20/mi could add ~$180 this week.
        </p>
      </div>
    </div>
  )
}

export function HistoryPreview() {
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
            <div
              key={idx}
              className="flex items-center justify-between py-1 border-b border-border/60 last:border-0"
            >
              <div>
                <div className="text-[10px] font-semibold text-white">{r.p}</div>
                <div className="text-[8px] text-muted">
                  {r.t} · {r.d}
                </div>
              </div>
              <div className={`text-[11px] font-bold ${r.neg ? 'text-red' : 'text-green'}`}>{r.a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
