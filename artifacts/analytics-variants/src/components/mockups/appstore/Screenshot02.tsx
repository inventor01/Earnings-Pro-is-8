import React from "react";
import { AppStoreFrame } from "./_PhoneFrame";
export function Screenshot02() {
  return (
    <AppStoreFrame headline={<>Spot your<br /><span className="text-white">peak earning hours</span></>}>
      <img src="/images/screenshot-02.png" alt="Peak hours analytics" className="w-full h-full object-cover object-top" />
    </AppStoreFrame>
  );
}
