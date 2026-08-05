import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
import { EditorialStory } from "../EditorialStory";

export function AppStore_EditorialStory() {
  return (
    <AppStoreFrame headline={<>Your earnings story,<br />beautifully told.</>}>
      <div className="w-full h-full overflow-hidden" style={{ transform: "scale(0.72)", transformOrigin: "top center" }}>
        <EditorialStory />
      </div>
    </AppStoreFrame>
  );
}
