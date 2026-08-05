import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
import { Paywall } from "../onboarding/Paywall";

export function AppStore_Onb_Paywall() {
  return (
    <AppStoreFrame headline={<>Start your free<br />7-day trial.</>}>
      <div className="w-full h-full overflow-hidden" style={{ transform: "scale(0.78)", transformOrigin: "top center" }}>
        <Paywall />
      </div>
    </AppStoreFrame>
  );
}
