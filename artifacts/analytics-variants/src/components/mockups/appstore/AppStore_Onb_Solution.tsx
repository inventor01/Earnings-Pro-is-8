import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
import { Solution } from "../onboarding/Solution";

export function AppStore_Onb_Solution() {
  return (
    <AppStoreFrame headline={<>Real profit.<br />Not just gross pay.</>}>
      <div className="w-full h-full overflow-hidden" style={{ transform: "scale(0.78)", transformOrigin: "top center" }}>
        <Solution />
      </div>
    </AppStoreFrame>
  );
}
