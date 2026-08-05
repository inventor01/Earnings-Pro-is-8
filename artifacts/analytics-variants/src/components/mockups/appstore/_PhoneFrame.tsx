import React from "react";

/**
 * Shared App Store display-preview wrapper.
 * Yellow brand background + iPhone 14 Pro mockup shape.
 * Children are rendered inside the phone screen at 390×844 logical px.
 */
export function AppStoreFrame({
  headline,
  children,
}: {
  headline: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="w-screen h-screen bg-[#facc15] flex flex-col items-center overflow-hidden">
      {/* Headline */}
      <div className="w-full px-[8%] pt-[7%] pb-[3%] text-center">
        <h1
          className="text-black font-extrabold leading-tight tracking-tight"
          style={{ fontSize: "clamp(14px, 5.8vw, 28px)" }}
        >
          {headline}
        </h1>
      </div>

      {/* iPhone body */}
      <div className="relative flex-1 w-full flex justify-center" style={{ minHeight: 0 }}>
        <div
          className="relative bg-black"
          style={{
            height: "104%",
            aspectRatio: "390 / 844",
            padding: "2.6%",
            borderTopLeftRadius: "18%",
            borderTopRightRadius: "18%",
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          }}
        >
          {/* Screen */}
          <div
            className="w-full h-full overflow-hidden bg-[#101010]"
            style={{ borderTopLeftRadius: "16%", borderTopRightRadius: "16%" }}
          >
            {children}
          </div>
          {/* Dynamic Island notch */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bg-black rounded-full"
            style={{ top: "2%", width: "30%", height: "2.8%" }}
          />
        </div>
      </div>
    </div>
  );
}
