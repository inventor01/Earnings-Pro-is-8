import React from "react";
import {
  PERIOD_LABEL,
  days,
  totals,
  platforms,
  expensesByCategory,
  hourlyEarnings,
  peakHourLabel,
  wowChangePct,
  money,
} from "../../lib/analyticsSampleData";
import { ArrowUpRight, ArrowDownRight, Clock, MapPin, Gauge, Fuel } from "lucide-react";

export function CockpitHUD() {
  const maxHourly = Math.max(...hourlyEarnings);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono flex justify-center pb-20">
      <div className="w-[390px] bg-[#0a0a0a] shadow-2xl relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#facc15] opacity-10 blur-[100px] rounded-full pointer-events-none" />

        <div className="p-6">
          <header className="flex justify-between items-center mb-8 border-b border-[#262626] pb-4">
            <h1 className="text-xl font-bold tracking-widest text-[#f1f5f9] uppercase">TELEMETRY</h1>
            <div className="text-xs text-[#facc15] font-bold tracking-widest bg-[#2a2410] px-3 py-1 rounded-sm border border-[#ca8a04]/30">
              {PERIOD_LABEL.toUpperCase()}
            </div>
          </header>

          {/* Main Gauges */}
          <div className="mb-10 relative">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[#94a3b8] text-xs uppercase tracking-widest">Net Profit</span>
              <div className="flex items-center gap-1 text-[#22c55e] text-xs">
                <ArrowUpRight size={14} />
                <span>{wowChangePct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="text-5xl font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_15px_rgba(250,204,21,0.3)]">
              {money(totals.net)}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-[#111111] border border-[#262626] p-4 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#facc15]" />
                <div className="flex items-center gap-2 text-[#94a3b8] mb-1">
                  <Clock size={14} />
                  <span className="text-[10px] uppercase tracking-wider">Per Hour</span>
                </div>
                <div className="text-xl font-bold text-[#facc15]">{money(totals.hourly)}</div>
              </div>
              <div className="bg-[#111111] border border-[#262626] p-4 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#facc15]" />
                <div className="flex items-center gap-2 text-[#94a3b8] mb-1">
                  <MapPin size={14} />
                  <span className="text-[10px] uppercase tracking-wider">Per Mile</span>
                </div>
                <div className="text-xl font-bold text-[#facc15]">{money(totals.perMile)}</div>
              </div>
            </div>
          </div>

          {/* RPM / Telemetry strip */}
          <div className="mb-10">
            <h3 className="text-[#64748b] text-[10px] uppercase tracking-widest mb-3 flex items-center gap-2">
              <Gauge size={12} /> Hourly Output (24H)
            </h3>
            <div className="flex items-end gap-[2px] h-20 bg-[#111111] p-2 rounded-xl border border-[#262626]">
              {hourlyEarnings.map((val, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-[#ca8a04]/20 to-[#facc15] rounded-t-sm"
                  style={{ height: `${Math.max(4, (val / maxHourly) * 100)}%`, opacity: val > 0 ? 1 : 0.2 }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-[#64748b] mt-2 font-bold">
              <span>00:00</span>
              <span className="text-[#facc15]">PEAK: {peakHourLabel}</span>
              <span>23:00</span>
            </div>
          </div>

          {/* Revenue vs Expenses Meter */}
          <div className="mb-10">
            <h3 className="text-[#64748b] text-[10px] uppercase tracking-widest mb-3">Gross / Burn</h3>
            <div className="bg-[#111111] border border-[#262626] p-4 rounded-xl">
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-white font-bold">GROSS {money(totals.revenue)}</span>
                <span className="text-[#ef4444] font-bold">BURN {money(totals.expenses)}</span>
              </div>
              <div className="h-3 w-full bg-[#1a1a1a] rounded-full overflow-hidden flex">
                <div className="h-full bg-[#22c55e]" style={{ width: `${(totals.net / totals.revenue) * 100}%` }} />
                <div className="h-full bg-[#ef4444]" style={{ width: `${(totals.expenses / totals.revenue) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Platform Split Grid */}
          <div className="mb-10">
            <h3 className="text-[#64748b] text-[10px] uppercase tracking-widest mb-3">Vector Split</h3>
            <div className="grid grid-cols-2 gap-2">
              {platforms.map(p => (
                <div key={p.name} className="bg-[#111111] border border-[#262626] p-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-xs text-[#cbd5e1]">{p.name}</span>
                  </div>
                  <span className="text-sm font-bold text-white tabular-nums">{money(p.net)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses */}
          <div>
            <h3 className="text-[#64748b] text-[10px] uppercase tracking-widest mb-3 flex items-center gap-2">
              <Fuel size={12} /> Consumables
            </h3>
            <div className="space-y-2">
              {expensesByCategory.map(e => (
                <div key={e.name} className="flex justify-between items-center text-xs bg-[#111111] p-3 rounded-lg border border-[#262626]">
                  <span className="text-[#94a3b8] uppercase tracking-wider">{e.name}</span>
                  <span className="text-[#ef4444] font-bold">-{money(e.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CockpitHUD;