import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
import { Welcome } from "../onboarding/Welcome";

export function AppStore_Onb_Welcome() {
  return (
    <AppStoreFrame headline={<>Track every dollar<br />you earn.</>}>
      <div className="w-full h-full overflow-hidden" style={{ transform: "scale(0.78)", transformOrigin: "top center" }}>
        <Welcome />
      </div>
    </AppStoreFrame>
  );
}
