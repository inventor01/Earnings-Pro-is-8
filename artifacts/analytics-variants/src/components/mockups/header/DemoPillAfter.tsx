// AFTER — the DEMO pill now lives inline in the header, taking the wordmark's
// spot during a demo session. Nothing floats over the action buttons.
import { Phone, Logo, IconRow, DemoPill, FilterPills, NetProfitCard } from "./_DemoHeaderParts";

export function DemoPillAfter() {
  return (
    <Phone>
      <div className="flex items-center justify-between gap-2 bg-white px-4 pt-2 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo />
          <DemoPill />
        </div>
        <IconRow />
      </div>
      <div className="relative">
        <div className="absolute right-2 -top-1 rounded-lg bg-green-600 px-2 py-1 text-[10px] font-bold text-white shadow z-10">
          ✓ all buttons tappable
        </div>
        <FilterPills />
      </div>
      <NetProfitCard />
    </Phone>
  );
}
