import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
export function Screenshot05() {
  return (
    <AppStoreFrame headline={<>Your data, your way<br /><span className="text-white">export to CSV anytime</span></>}>
      <img src="/images/screenshot-05.png" alt="Settings and export" className="w-full h-full object-cover object-top" />
    </AppStoreFrame>
  );
}
