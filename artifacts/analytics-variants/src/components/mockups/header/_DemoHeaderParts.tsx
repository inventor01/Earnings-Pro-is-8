// Shared pieces for the DEMO-pill before/after comparison frames.
// Faithful web recreation of the Expo dashboard header (light theme):
// logo + wordmark left, five 36dp icon buttons right, filter pills below.
import { Search, Calendar, Eye, Moon, Settings } from "lucide-react";

export function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-9 h-9 rounded-[10px] bg-white border border-gray-200 flex items-center justify-center shrink-0">
      {children}
    </div>
  );
}

export function IconRow() {
  return (
    <div className="flex gap-2 shrink-0">
      <IconBtn><Search className="w-[17px] h-[17px] text-gray-400" /></IconBtn>
      <IconBtn><Calendar className="w-[17px] h-[17px] text-gray-400" /></IconBtn>
      <IconBtn><Eye className="w-[17px] h-[17px] text-gray-400" /></IconBtn>
      <IconBtn><Moon className="w-[17px] h-[17px] text-gray-400" /></IconBtn>
      <IconBtn><Settings className="w-[17px] h-[17px] text-gray-400" /></IconBtn>
    </div>
  );
}

export function Logo() {
  return (
    <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center shrink-0 text-lg">
      🥷
    </div>
  );
}

export function DemoPill({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center rounded-full border border-green-500 bg-green-600/[0.14] px-3 py-[5px] ${className}`}>
      <span className="w-[7px] h-[7px] rounded-full bg-green-500 mr-1.5 shrink-0" />
      <span className="text-green-600 font-extrabold text-xs tracking-wide whitespace-nowrap">
        DEMO · sample data
      </span>
    </div>
  );
}

export function FilterPills() {
  return (
    <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-100 overflow-hidden">
      <span className="px-4 py-2 rounded-full bg-yellow-400 text-gray-900 text-sm font-bold shrink-0">Today</span>
      {["Yesterday", "This Week", "Last 7 Days"].map(t => (
        <span key={t} className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-500 text-sm font-semibold shrink-0">{t}</span>
      ))}
    </div>
  );
}

export function NetProfitCard() {
  return (
    <div className="mx-4 mt-4 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-widest text-gray-400">NET PROFIT</span>
        <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">Revenue: $105.09</span>
      </div>
      <div className="mt-2 text-4xl font-black text-green-500">$105.09</div>
      <div className="mt-3 text-center text-sm font-semibold text-gray-500">Today · Aug 10</div>
    </div>
  );
}

export function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-full bg-gray-50 overflow-hidden relative">
      {/* status bar */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1 bg-white text-[11px] font-semibold text-gray-700">
        <span>3:27</span>
        <span className="tracking-widest">▮▮▮ 📶 🔋</span>
      </div>
      {children}
    </div>
  );
}
