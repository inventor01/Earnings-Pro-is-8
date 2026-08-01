import React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Shell,useBuild } from "./_shared";
const items=["Personalized dashboard","Profit tracking","Goal tracking","Tax-ready records"];
export function BuildingDashboard(){const n=useBuild();return <Shell chrome={false}><div className="flex h-full min-h-[760px] flex-col justify-center"><h1 className="text-center text-[24px] font-black leading-[1.25]">Building your personalized<br/>dashboard…</h1><div className="mx-auto mt-8 space-y-4">{items.map((x,i)=><div className="flex items-center gap-3" key={x}>{i<n?<CheckCircle2 className="text-[#22c55e]" size={24}/>:<Circle className="text-[#292929]" size={24}/>}<span className={`text-[16.5px] font-semibold ${i<n?"font-extrabold text-white":"text-[#929292]"}`}>{x}</span></div>)}</div></div></Shell>}
export default BuildingDashboard;