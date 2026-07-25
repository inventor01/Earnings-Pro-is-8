import React from "react";
import {
  PERIOD_LABEL,
  days,
  totals,
  platforms,
  expensesByCategory,
  wowChangePct,
  money,
  last28Days,
} from "../../lib/analyticsSampleData";

export function NeonTerminal() {
  return (
    <div className="min-h-screen bg-[#000] text-[#facc15] font-mono flex justify-center pb-20 selection:bg-[#facc15] selection:text-black">
      <div className="w-[390px] bg-[#050505] shadow-[0_0_50px_rgba(250,204,21,0.05)] relative overflow-hidden border-x border-[#111]">
        
        {/* Scanline overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20 z-50 mix-blend-overlay" />

        <div className="p-5">
          <header className="mb-6 flex justify-between items-start border-b border-[#facc15]/20 pb-4">
            <div>
              <p className="text-[10px] opacity-70 mb-1">&gt; ./sys/analytics --period="{PERIOD_LABEL}"</p>
              <h1 className="text-xl font-bold tracking-tight">PROFIT_MATRIX</h1>
            </div>
            <div className="w-2 h-4 bg-[#facc15] animate-pulse" />
          </header>

          {/* Hero Block */}
          <div className="mb-6 bg-[#121000] border border-[#facc15]/30 p-4 relative group">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#facc15] to-transparent opacity-50" />
            <p className="text-[10px] uppercase opacity-70 mb-2">[ NET_REVENUE ]</p>
            <div className="text-4xl font-bold tracking-tighter tabular-nums text-white drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]">
              {money(totals.net)}
            </div>
            <div className="flex justify-between items-center mt-3 text-xs">
              <span className="opacity-70">W/W_DELTA:</span>
              {/* Positive delta remains green for semantic meaning */}
              <span className={wowChangePct >= 0 ? "text-[#22c55e]" : "text-red-500"}>
                {wowChangePct >= 0 ? "+" : ""}{wowChangePct.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Matrix Heatmap */}
          <div className="mb-6">
            <p className="text-[10px] uppercase opacity-70 mb-2">&gt; 28_DAY_ACTIVITY_MAP</p>
            <div className="grid grid-cols-7 gap-1 bg-[#0a0a0a] p-2 border border-[#111] rounded-sm">
              {last28Days.map((val, i) => {
                let opacity = 0.1;
                if (val > 0) opacity = 0.3;
                if (val > 50) opacity = 0.6;
                if (val > 80) opacity = 1.0;
                return (
                  <div 
                    key={i} 
                    className="aspect-square rounded-[2px]"
                    style={{ backgroundColor: `rgba(250,204,21,${opacity})` }}
                  />
                );
              })}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-[#0a0800] border border-[#facc15]/20 p-3">
              <p className="text-[10px] opacity-60 mb-1">$/HR</p>
              <p className="text-lg font-bold text-white">{money(totals.hourly)}</p>
            </div>
            <div className="bg-[#0a0800] border border-[#facc15]/20 p-3">
              <p className="text-[10px] opacity-60 mb-1">$/MILE</p>
              <p className="text-lg font-bold text-white">{money(totals.perMile)}</p>
            </div>
            <div className="bg-[#0a0800] border border-[#facc15]/20 p-3">
              <p className="text-[10px] opacity-60 mb-1">GROSS</p>
              <p className="text-lg font-bold text-[#facc15]">{money(totals.revenue)}</p>
            </div>
            {/* Burn/Expenses remains red for semantic meaning */}
            <div className="bg-[#110505] border border-[#ff3333]/20 p-3">
              <p className="text-[10px] text-[#ff3333] opacity-80 mb-1">BURN</p>
              <p className="text-lg font-bold text-[#ff3333]">{money(totals.expenses)}</p>
            </div>
          </div>

          {/* Node Breakdown */}
          <div className="mb-6">
            <p className="text-[10px] uppercase opacity-70 mb-3">&gt; NODE_CONNECTIONS (PLATFORMS)</p>
            <div className="space-y-3">
              {platforms.map(p => (
                <div key={p.name} className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between">
                    <span>{p.name.toUpperCase()}</span>
                    <span className="text-white">{money(p.net)}</span>
                  </div>
                  <div className="h-[2px] w-full bg-[#111]">
                    <div className="h-full bg-[#facc15]" style={{ width: `${(p.net / totals.net) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal Footer */}
          <div className="mt-8 border-t border-[#facc15]/20 pt-4 text-[10px] opacity-50 flex justify-between">
            <span>SYS.STATUS: ONLINE</span>
            <span>END_OF_LINE</span>
          </div>

        </div>
      </div>
    </div>
  );
}

export default NeonTerminal;