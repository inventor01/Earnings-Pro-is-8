import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
import { Challenge } from "../onboarding/Challenge";

export function AppStore_Onb_Challenge() {
  return (
    <AppStoreFrame headline={<>Built for your<br />biggest challenge.</>}>
      <div className="w-full h-full overflow-hidden" style={{ transform: "scale(0.78)", transformOrigin: "top center" }}>
        <Challenge />
      </div>
    </AppStoreFrame>
  );
}
