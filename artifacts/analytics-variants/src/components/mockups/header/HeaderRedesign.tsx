// Header redesign — app name big & centered at top, logo inline with the menu icons, larger tap targets.
// Mirrors the live dashboard (dark theme) below the header so the change is seen in context.

const yellow = "#FACC15";
const bg = "#0B0B0B";
const card = "#161616";

function Icon({ d, size = 26 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#C9CDD6" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const icons = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35",
  calendar: "M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5L9 5.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2L9.5 21h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2Z",
};

function IconBtn({ d }: { d: string }) {
  return (
    <div style={{ width: 52, height: 52, borderRadius: 16, background: "#1A1A1A", border: "1px solid #262626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon d={d} />
    </div>
  );
}

export default function HeaderRedesign() {
  return (
    <div style={{ width: 390, minHeight: 844, background: bg, fontFamily: "'Barlow', system-ui, sans-serif", color: "#fff", margin: "0 auto", overflow: "hidden" }}>
      {/* status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px 0", fontWeight: 700, fontSize: 16 }}>
        <span>1:10</span>
        <span style={{ letterSpacing: 2 }}>▮▮ ⏻</span>
      </div>

      {/* NEW: big centered app name */}
      <div style={{ textAlign: "center", padding: "10px 0 2px" }}>
        <div style={{ fontFamily: "'Barlow Condensed', 'Barlow', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: 2.5 }}>
          EARNINGS <span style={{ color: yellow }}>NINJA</span>
        </div>
      </div>

      {/* NEW: logo inline with menu icons, everything larger */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 12px", gap: 10 }}>
        <img src="/images/ninja-logo.png" alt="Earnings Ninja logo" style={{ width: 54, height: 58, objectFit: "contain", flexShrink: 0 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <IconBtn d={icons.search} />
          <IconBtn d={icons.calendar} />
          <IconBtn d={icons.eye} />
          <IconBtn d={icons.sun} />
          <IconBtn d={icons.gear} />
        </div>
      </div>

      {/* period pills */}
      <div style={{ display: "flex", gap: 10, padding: "4px 16px 16px", borderTop: "1px solid #1E1E1E", paddingTop: 14, overflow: "hidden" }}>
        {["Today", "Yesterday"].map((t) => (
          <div key={t} style={{ padding: "12px 22px", borderRadius: 999, background: "#1A1A1A", color: "#E5E7EB", fontWeight: 600, fontSize: 16, whiteSpace: "nowrap" }}>{t}</div>
        ))}
        <div style={{ padding: "12px 22px", borderRadius: 999, background: yellow, color: "#111", fontWeight: 800, fontSize: 16, whiteSpace: "nowrap" }}>This Week</div>
        <div style={{ padding: "12px 22px", borderRadius: 999, background: "#1A1A1A", color: "#E5E7EB", fontWeight: 600, fontSize: 16, whiteSpace: "nowrap" }}>Last 7</div>
      </div>

      {/* net profit card (context) */}
      <div style={{ margin: "4px 16px", background: card, borderRadius: 24, padding: 20, boxShadow: "0 0 24px rgba(250,204,21,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: yellow, fontWeight: 800, letterSpacing: 2, fontSize: 13 }}>NET PROFIT</span>
          <span style={{ background: "#222", borderRadius: 12, padding: "6px 12px", fontSize: 14, fontWeight: 700 }}>Revenue: <span>$0.00</span> ⇄</span>
        </div>
        <div style={{ color: "#4ADE80", fontSize: 52, fontWeight: 800, margin: "10px 0 6px" }}>$0.00</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#D1D5DB", fontWeight: 600 }}>
          <span style={{ color: yellow }}>‹</span>
          <span>This Week's earnings</span>
          <span style={{ color: yellow }}>›</span>
        </div>
        <div style={{ textAlign: "center", color: "#6B7280", letterSpacing: 3, fontWeight: 700, fontSize: 13, padding: "34px 0" }}>NO ENTRIES YET</div>
        <div style={{ display: "flex", borderTop: "1px solid #242424", paddingTop: 14 }}>
          {[["EXPENSES ›", "$0", yellow], ["ORDERS", "0", "#9CA3AF"], ["AVG ORDER", "$0", "#9CA3AF"]].map(([label, val, c]) => (
            <div key={label as string} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ color: c as string, fontSize: 12, fontWeight: 800, letterSpacing: 1.5 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* stat tiles */}
      <div style={{ display: "flex", gap: 12, margin: "12px 16px" }}>
        {[["📍", "$0.00", "$/MILE"], ["🚗", "0.0", "MILES"]].map(([e, v, l]) => (
          <div key={l as string} style={{ flex: 1, background: card, borderRadius: 20, padding: 16 }}>
            <div style={{ fontSize: 22 }}>{e}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{v}</div>
            <div style={{ color: "#6B7280", fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
