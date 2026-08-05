import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
export function Screenshot01() {
  return (
    <AppStoreFrame headline={<>Your real profit,<br /><span className="text-[#facc15]">not just gross pay</span></>}>
      <img src="/images/screenshot-01.png" alt="Dashboard" className="w-full h-full object-cover object-top" />
    </AppStoreFrame>
  );
}
