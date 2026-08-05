import React from "react";

/**
 * App Store display-preview template — outcome-first layout.
 *
 * Layout (fixed, identical across all screenshots):
 *   – ~15% headline: two-line Barlow Condensed 900; line 2 is the emphasized
 *     key phrase (larger). Tight line spacing.
 *   – ~85% phone: iPhone 14 Pro frame, aspect-locked 393:852, dominates the
 *     canvas and bleeds off the bottom edge. Identical position/scale on
 *     every screenshot.
 *   – Subtle radial glow behind the phone for depth on the flat yellow.
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
        width: "100vw",
        height: "100vh",
        background:
          "radial-gradient(120% 90% at 50% 42%, #ffd83d 0%, #facc15 55%, #eabb06 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        fontFamily: "'Barlow Condensed', sans-serif",
      }}
    >
      {/* ── Headline — 15% of height, tight to the phone ── */}
      <div
        style={{
          height: "15vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: "1vh",
          width: "92%",
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            lineHeight: 1.0,
            letterSpacing: "-0.5px",
            fontSize: "clamp(20px, 6.4vw, 58px)",
            color: "#000",
            whiteSpace: "nowrap",
          }}
        >
          {line1}
        </div>
        <div
          style={{
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: "-0.5px",
            fontSize: "clamp(26px, 8.6vw, 78px)",
            color: "#fff",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            textShadow: "0 2px 12px rgba(0,0,0,0.10)",
          }}
        >
          {line2}
        </div>
      </div>

      {/* ── Phone — dominates the canvas, bleeds off the bottom ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          overflow: "visible",
          paddingTop: "1.2vh",
          position: "relative",
        }}
      >
        {/* Soft vignette glow behind the phone */}
        <div
          style={{
            position: "absolute",
            top: "-2%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "120vw",
            height: "60vh",
            background:
              "radial-gradient(50% 50% at 50% 40%, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0) 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Phone body — aspect-locked to iPhone 14 Pro hardware ratio */}
        <div
          style={{
            width: "92vw",
            aspectRatio: "393 / 852",
            background: "#0a0a0a",
            borderRadius: "10%",
            padding: "2%",
            boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
            position: "relative",
            boxSizing: "border-box",
            flexShrink: 0,
            zIndex: 1,
          }}
        >
          {/* Screen area */}
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: "8.5%",
              background: "#000",
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
                objectPosition: "top center",
                display: "block",
              }}
            />

            {/* Dynamic Island pill — centred over the status-bar gap */}
            <div
              style={{
                position: "absolute",
                top: "1.6%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "32%",
                height: "3.5%",
                background: "#000",
                borderRadius: "999px",
                zIndex: 2,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
