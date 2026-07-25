import React from "react";
import {
  PERIOD_LABEL,
  days,
  totals,
  platforms,
  expensesByCategory,
  hourlyEarnings,
  wowChangePct,
  money,
} from "../../lib/analyticsSampleData";

export function EditorialStory() {
  const isUp = wowChangePct > 0;

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#111] font-serif flex justify-center pb-20">
      <div className="w-[390px] bg-white shadow-xl relative overflow-hidden">
        <div className="p-8">
          <header className="mb-12 pt-6">
            <p className="text-[11px] font-sans tracking-[0.2em] text-[#666] uppercase mb-4">
              Weekly Report &mdash; {PERIOD_LABEL}
            </p>
            <h1 className="text-4xl leading-tight font-medium tracking-tight">
              You earned <br/>
              <span className="text-[#facc15] font-bold mix-blend-multiply">{money(totals.net)}</span><br/>
              this week.
            </h1>
            <p className="mt-4 text-[15px] font-sans text-[#555] leading-relaxed">
              That's <strong className={isUp ? "text-green-600" : "text-red-600"}>{isUp ? 'up' : 'down'} {Math.abs(wowChangePct).toFixed(1)}%</strong> from last week. You drove a total of {totals.miles} miles across {totals.hours} hours.
            </p>
          </header>

          <div className="h-[1px] w-full bg-[#eee] mb-10" />

          {/* Narrative Stats */}
          <div className="mb-12 font-sans">
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[#999] mb-6">Efficiency</h2>
            <div className="space-y-6">
              <div>
                <p className="text-3xl font-light tabular-nums tracking-tighter mb-1">{money(totals.hourly)}</p>
                <p className="text-[13px] text-[#666]">Average per hour.</p>
              </div>
              <div>
                <p className="text-3xl font-light tabular-nums tracking-tighter mb-1">{money(totals.perMile)}</p>
                <p className="text-[13px] text-[#666]">Average per mile driven.</p>
              </div>
              <div>
                <p className="text-3xl font-light tabular-nums tracking-tighter mb-1">{totals.orders}</p>
                <p className="text-[13px] text-[#666]">Total deliveries completed.</p>
              </div>
            </div>
          </div>

          <div className="h-[1px] w-full bg-[#eee] mb-10" />

          {/* Platform Performance */}
          <div className="mb-12 font-sans">
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[#999] mb-6">By Platform</h2>
            <div className="space-y-5">
              {platforms.sort((a,b) => b.net - a.net).map((p) => (
                <div key={p.name}>
                  <div className="flex justify-between text-[14px] mb-2">
                    <span className="font-medium text-[#222]">{p.name}</span>
                    <span className="tabular-nums">{money(p.net)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#f5f5f5] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ width: `${(p.net / platforms[0].net) * 100}%`, backgroundColor: p.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Sparkline */}
          <div className="mb-12">
            <h2 className="text-[13px] font-sans font-semibold uppercase tracking-widest text-[#999] mb-6">Daily Flow</h2>
            <div className="flex items-end justify-between h-24 gap-1">
              {days.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full bg-[#f0f0f0] rounded-sm relative flex-1 flex items-end">
                    <div 
                      className="w-full bg-[#facc15] rounded-sm transition-all" 
                      style={{ height: `${(d.net / Math.max(...days.map(x=>x.net))) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-sans text-[#999] uppercase">{d.label.charAt(0)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-[#fafafa] p-6 rounded-xl font-sans mb-8">
            <h2 className="text-[12px] font-semibold uppercase tracking-widest text-[#777] mb-4">Expenses ({money(totals.expenses)})</h2>
            <ul className="space-y-3">
              {expensesByCategory.map(e => (
                <li key={e.name} className="flex justify-between text-[14px]">
                  <span className="text-[#555]">{e.emoji} {e.name}</span>
                  <span className="font-medium">{money(e.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          
        </div>
      </div>
    </div>
  );
}

export default EditorialStory;