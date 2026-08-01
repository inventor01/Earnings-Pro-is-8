import React from "react";
import { Shell,Heading,Primary,BlurredCard } from "./_shared";
export function BlurredPreview(){return <Shell step={6}><Heading>Your dashboard<br/>is ready.</Heading><p>Here's a preview — premium analytics are waiting inside.</p><BlurredCard/><div className="mt-6"><Primary>Unlock My Personalized Dashboard</Primary></div><button className="w-full py-3.5 text-[13.5px] font-semibold text-[#929292]">Continue to dashboard</button></Shell>}
export default BlurredPreview;