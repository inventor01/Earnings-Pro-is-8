// BEFORE — the DEMO pill floated top-center as an overlay, sitting on top of
// the header's search/calendar buttons and stealing their taps.
import { Phone, Logo, IconRow, DemoPill, FilterPills, NetProfitCard } from "./_DemoHeaderParts";

export function DemoPillBefore() {
  return (
    <Phone>
      <div className="relative">
        <div className="flex items-center justify-between gap-2 bg-white px-4 pt-2 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo />
            <span className="font-black text-[15px] tracking-tight text-gray-900 truncate">
              EARNINGS <span className="text-yellow-500">NINJA</span>
            </span>
          </div>
          <IconRow />
        </div>
        {/* floating overlay pill — blocks the buttons underneath */}
        <div className="absolute inset-x-0 top-1 flex justify-center pointer-events-none">
          <DemoPill className="shadow-md ring-2 ring-red-400/70" />
        </div>
        {/* annotation */}
        <div className="absolute right-2 top-12 rounded-lg bg-red-500 px-2 py-1 text-[10px] font-bold text-white shadow">
          ✕ covers Search &amp; Calendar
        </div>
      </div>
      <FilterPills />
      <NetProfitCard />
    </Phone>
  );
}
