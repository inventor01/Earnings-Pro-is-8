import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
import { GigApps } from "../onboarding/GigApps";

export function AppStore_Onb_GigApps() {
  return (
    <AppStoreFrame headline={<>All your apps.<br />One dashboard.</>}>
      <div className="w-full h-full overflow-hidden" style={{ transform: "scale(0.78)", transformOrigin: "top center" }}>
        <GigApps />
      </div>
    </AppStoreFrame>
  );
}
