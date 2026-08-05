import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
import { CockpitHUD } from "../CockpitHUD";

export function AppStore_CockpitHUD() {
  return (
    <AppStoreFrame headline={<>Every metric,<br />mission-critical clarity.</>}>
      <div className="w-full h-full overflow-hidden" style={{ transform: "scale(0.72)", transformOrigin: "top center" }}>
        <CockpitHUD />
      </div>
    </AppStoreFrame>
  );
}
