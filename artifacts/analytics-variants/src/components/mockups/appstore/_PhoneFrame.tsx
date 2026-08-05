import React from "react";

/**
 * Fixed App Store display-preview template — 1284×2778 canvas.
 *
 * Layout (fixed, identical across all screenshots):
 *   – Top 22%:  two-line headline in Barlow Condensed 900
 *   – Remaining: centred iPhone mockup, bleeds slightly off the bottom edge
 *
 * Only the headline text and the <img> src change between screens.
 * Pass `appImage` as the cropped app-UI path (e.g. "/images/app-01.png").
 * Pass `headline` as [line1, line2] — line1 is black, line2 is white.
 */
export function AppStoreFrame({
  line1,
  line2,
  appImage,
  altText = "",
}: {
  line1: string;
  line2: string;
  appImage: string;
  altText?: string;
}) {
  return (
    <div
      style={{
        // Fixed canvas proportions — always fills the iframe viewport
        width: "100vw",
        height: "100vh",
        background: "#facc15",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        fontFamily: "'Barlow Condensed', sans-serif",
      }}
    >
      {/* ─── Headline block — fixed height 22 vh ─── */}
      <div
        style={{
          height: "22vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: "2vh",
          width: "84%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: "-0.5px",
            fontSize: "clamp(18px, 6.2vw, 52px)",
            color: "#000",
            whiteSpace: "nowrap",
          }}
        >
          {line1}
        </div>
        <div
          style={{
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: "-0.5px",
            fontSize: "clamp(18px, 6.2vw, 52px)",
            color: "#fff",
            whiteSpace: "nowrap",
          }}
        >
          {line2}
        </div>
      </div>

      {/* ─── Phone mockup — fills remaining space, bleeds bottom ─── */}
      <div
        style={{
          flex: 1,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          overflow: "visible",
        }}
      >
        {/* Phone body */}
        <div
          style={{
            // Keep phone width at 76% of viewport width; height auto via aspect ratio
            width: "76vw",
            // iPhone 14 Pro body ratio (393px wide : 852px tall ≈ 0.461)
            // We add bezel: ~5.5% padding each side = ~111% of screen height
            height: "114vh",
            background: "#0a0a0a",
            borderRadius: "12% / 6%",
            padding: "2.4%",
            boxShadow: "0 28px 70px rgba(0,0,0,0.45)",
            position: "relative",
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        >
          {/* Screen area */}
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: "10% / 5%",
              background: "#101010",
              position: "relative",
            }}
          >
            <img
              src={appImage}
              alt={altText}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top",
                display: "block",
              }}
            />
          </div>

          {/* Dynamic Island pill */}
          <div
            style={{
              position: "absolute",
              top: "2.2%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "28%",
              height: "2.5%",
              background: "#0a0a0a",
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    </div>
  );
}
