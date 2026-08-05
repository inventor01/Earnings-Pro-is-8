import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
export function Screenshot03() {
  return (
    <AppStoreFrame headline={<>See which apps<br /><span className="text-[#facc15]">pay you the most</span></>}>
      <img src="/images/screenshot-03.png" alt="Top apps by earnings" className="w-full h-full object-cover object-top" />
    </AppStoreFrame>
  );
}
