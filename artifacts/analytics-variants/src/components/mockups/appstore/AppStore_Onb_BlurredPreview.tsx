import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
import { BlurredPreview } from "../onboarding/BlurredPreview";

export function AppStore_Onb_BlurredPreview() {
  return (
    <AppStoreFrame headline={<>Your dashboard<br />is ready to unlock.</>}>
      <div className="w-full h-full overflow-hidden" style={{ transform: "scale(0.78)", transformOrigin: "top center" }}>
        <BlurredPreview />
      </div>
    </AppStoreFrame>
  );
}
