import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
export function Screenshot04() {
  return (
    <AppStoreFrame headline={<>Every day's profit<br /><span className="text-white">at a glance</span></>}>
      <img src="/images/screenshot-04.png" alt="Daily profit breakdown" className="w-full h-full object-cover object-top" />
    </AppStoreFrame>
  );
}
