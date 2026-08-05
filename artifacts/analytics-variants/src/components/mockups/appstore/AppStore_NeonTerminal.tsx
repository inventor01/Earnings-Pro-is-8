import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
import { NeonTerminal } from "../NeonTerminal";

export function AppStore_NeonTerminal() {
  return (
    <AppStoreFrame headline={<>Sharp data.<br />Zero noise.</>}>
      <div className="w-full h-full overflow-hidden" style={{ transform: "scale(0.72)", transformOrigin: "top center" }}>
        <NeonTerminal />
      </div>
    </AppStoreFrame>
  );
}
