import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronRight, LockKeyhole, TrendingUp } from "lucide-react";

export const apps = ["DoorDash", "Uber Eats", "Spark", "Instacart", "Grubhub", "Other"];
export const challenges = [
  ["Not making enough", "trending-down"],
  ["I don't know my real profit", "calculator"],
  ["Staying organized", "folder"],
  ["Taxes stress me out", "file-text"],
];

export function Shell({ children, step = 0, chrome = true }: { children: React.ReactNode; step?: number; chrome?: boolean }) {
  return <main className="min-h-[100dvh] w-full bg-[#0a0a0a] text-[#f7f7f5] flex justify-center font-sans">
    <div className="relative flex min-h-[844px] h-[100dvh] w-full max-w-[390px] flex-col overflow-hidden bg-[#0a0a0a]">
      {chrome ? <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button aria-label="Go back" className="text-[#777] hover:text-white"><ArrowLeft size={22}/></button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#171717]"><div className="h-full rounded-full bg-[#facc15] transition-all" style={{width:`${((step+1)/7)*100}%`}}/></div>
      </div> : <div className="h-[44px] shrink-0"/>}
      <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
    </div>
  </main>
}
export function Primary({ children, onClick }: { children: React.ReactNode; onClick?:()=>void }) {
 return <button onClick={onClick} className="w-full rounded-full bg-[#facc15] py-[17px] text-[17px] font-black tracking-[.2px] text-[#090909] shadow-[0_7px_24px_rgba(250,204,21,.2)] transition-transform active:scale-[.98]">{children}</button>
}
export function Heading({children, sub}:{children:React.ReactNode;sub:React.ReactNode}) { return <><h1 className="mt-3 text-[27px] font-black leading-[1.18] tracking-[-.5px]">{children}</h1><p className="mt-2 text-[14.5px] leading-5 text-[#929292]">{sub}</p></> }
export function CheckIcon({active=false}:{active?:boolean}) { return active ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#22c55e] text-[#071008]"><Check size={14} strokeWidth={3}/></span> : <span className="h-5 w-5 rounded-full border-2 border-[#292929]"/> }
export function BlurredCard() {
 const bars=[.45,.7,.55,.9,.65,1,.8];
 return <div className="relative mt-5 overflow-hidden rounded-[20px] border border-[#242424] bg-[#111]">
  <div className="p-4"><div className="text-[12px] font-bold tracking-[1px] text-[#929292]">WEEKLY GOAL</div><div className="mt-0.5 text-[28px] font-black">$500</div>
  <div className="mt-4 space-y-3">{["Real net profit","Best hours to drive","AI earning suggestions"].map(x=><div className="flex justify-between text-[13.5px] font-semibold text-[#929292]" key={x}><span>{x}</span><span className="h-[18px] w-[74px] rounded-md bg-[#252525]"/></div>)}</div>
  <div className="mt-5 flex h-[90px] items-end gap-2">{bars.map((h,i)=><div key={i} className="flex-1 rounded-t-md bg-[#facc15] opacity-25" style={{height:`${h*100}%`}}/>)}</div></div>
  <div className="absolute inset-x-0 bottom-0 top-[92px] flex items-center justify-center bg-[#0a0a0a]/60 backdrop-blur-[5px]"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#facc15] text-[#111]"><LockKeyhole size={20}/></div></div>
 </div>
}
export function useBuild() { const [n,setN]=useState(0); useEffect(()=>{const ts=[1,2,3,4].map(i=>setTimeout(()=>setN(i),600*i)); return()=>ts.forEach(clearTimeout)},[]); return n }