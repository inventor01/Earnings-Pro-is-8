import React from "react";

// App Store 6.5" display preview (1284x2778) — Analytics page
// Yellow brand background, iPhone mockup with the real analytics screenshot
// Screenshot native size: 1125x2436 (19.5:9)

export function AnalyticsDisplayPreview() {
  return (
    <div
      className="w-screen h-screen bg-[#facc15] flex flex-col items-center overflow-hidden"
      style={{ aspectRatio: "1284 / 2778" }}
    >
      {/* Headline */}
      <div className="w-full px-[6%] pt-[7%] pb-[4%] text-center">
        <h1
          className="text-black font-extrabold leading-tight tracking-tight"
          style={{ fontSize: "min(6.5vw, 3vh)" }}
        >
          Know your real numbers,
          <br />
          not just gross pay
        </h1>
      </div>

      {/* iPhone mockup */}
      <div
        className="relative flex-1 w-full flex justify-center"
        style={{ minHeight: 0 }}
      >
        <div
          className="relative bg-black rounded-t-[8%] shadow-2xl"
          style={{
            // phone body keeps the screenshot's 1125:2436 ratio + bezel
            height: "104%", // bleed off the bottom like the existing set
            aspectRatio: "1187 / 2560",
            padding: "2.6%",
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
            borderTopLeftRadius: "18%",
            borderTopRightRadius: "18%",
          }}
        >
          {/* Screen */}
          <div
            className="w-full h-full overflow-hidden bg-black"
            style={{
              borderTopLeftRadius: "16%",
              borderTopRightRadius: "16%",
            }}
          >
            <img
              src="/images/analytics-screen.png"
              alt="Analytics — all-time earnings, efficiency stats"
              className="w-full object-cover object-top"
              style={{ aspectRatio: "1125 / 2436" }}
            />
          </div>
          {/* Notch */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bg-black"
            style={{
              top: "2.2%",
              width: "42%",
              height: "3%",
              borderBottomLeftRadius: 999,
              borderBottomRightRadius: 999,
            }}
          />
        </div>
      </div>
    </div>
  );
}
