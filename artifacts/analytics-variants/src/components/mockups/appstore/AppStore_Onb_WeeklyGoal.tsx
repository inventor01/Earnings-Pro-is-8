import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
import { WeeklyGoal } from "../onboarding/WeeklyGoal";

export function AppStore_Onb_WeeklyGoal() {
  return (
    <AppStoreFrame headline={<>Set a goal.<br />Hit it every week.</>}>
      <div className="w-full h-full overflow-hidden" style={{ transform: "scale(0.78)", transformOrigin: "top center" }}>
        <WeeklyGoal />
      </div>
    </AppStoreFrame>
  );
}
