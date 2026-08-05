import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
import { BuildingDashboard } from "../onboarding/BuildingDashboard";

export function AppStore_Onb_Building() {
  return (
    <AppStoreFrame headline={<>Built just for<br />how you drive.</>}>
      <div className="w-full h-full overflow-hidden" style={{ transform: "scale(0.78)", transformOrigin: "top center" }}>
        <BuildingDashboard />
      </div>
    </AppStoreFrame>
  );
}
