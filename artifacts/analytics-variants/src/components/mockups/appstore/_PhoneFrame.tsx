import React from "react";

/**
 * App Store display-preview template — "Apple product page" treatment.
 *
 *   – Background: soft yellow→orange radial gradient, bright behind the phone,
 *     darker toward the edges, with a faint diagonal ninja-slash texture.
 *   – Headline: two lines in Barlow Condensed 900 on a subtle glass panel;
 *     line 2 is the emphasized ALL-CAPS key phrase (~30% larger).
 *   – Phone: iPhone 14 Pro frame, aspect-locked 393:852, dominates the canvas,
 *     bleeds off the bottom, floats on a glow + deep soft shadow.
 *   – Identical position/scale on every screenshot.
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
        /* Option A — yellow core → deeper amber edges */
        background:
          "radial-gradient(130% 95% at 50% 44%, #ffe159 0%, #fbcf1e 40%, #f2b90c 70%, #d99a05 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        fontFamily: "'Barlow Condensed', sans-serif",
        position: "relative",
      }}
    >
      {/* Faint diagonal slash texture — barely-there brand motif */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(135deg, rgba(0,0,0,0.025) 0px, rgba(0,0,0,0.025) 2px, transparent 2px, transparent 26px)",
          pointerEvents: "none",
        }}
      />

      {/* Soft edge vignette for depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(100% 100% at 50% 45%, transparent 55%, rgba(120,75,0,0.16) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Headline on a subtle glass panel ── */}
      <div
        style={{
          height: "15vh",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          flexShrink: 0,
          zIndex: 2,
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "1.2vh 5vw 1.4vh",
            marginBottom: "0.4vh",
            borderRadius: "2.4vh",
            background: "rgba(255,255,255,0.14)",
            border: "1px solid rgba(255,255,255,0.28)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            boxShadow: "0 8px 30px rgba(120,75,0,0.10)",
            maxWidth: "94%",
          }}
        >
          <div
            style={{
              fontWeight: 900,
              lineHeight: 1.0,
              letterSpacing: "-0.5px",
              fontSize: "clamp(20px, 6.2vw, 56px)",
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
              letterSpacing: "-0.3px",
              fontSize: "clamp(26px, 8.6vw, 78px)",
              color: "#fff",
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              textShadow: "0 2px 14px rgba(120,75,0,0.28)",
            }}
          >
            {line2}
          </div>
        </div>
      </div>

      {/* ── Phone — floating, dominant, bleeding off the bottom ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          overflow: "visible",
          paddingTop: "1.4vh",
          position: "relative",
          width: "100%",
          zIndex: 1,
        }}
      >
        {/* Moon-like glow directly behind the phone */}
        <div
          style={{
            position: "absolute",
            top: "-4%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "130vw",
            aspectRatio: "1 / 1",
            borderRadius: "50%",
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(255,246,200,0.65) 0%, rgba(255,240,160,0.25) 40%, rgba(255,240,160,0) 68%)",
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
            /* deep soft shadow + faint warm rim so the phone floats */
            boxShadow:
              "0 40px 90px rgba(60,35,0,0.50), 0 10px 30px rgba(60,35,0,0.35), 0 0 0 1px rgba(255,255,255,0.06), 0 0 60px rgba(255,220,90,0.35)",
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
