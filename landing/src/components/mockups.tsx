import type { ReactNode } from 'react'
import shot01 from '../assets/shot-01.webp'
import shot02 from '../assets/shot-02.webp'
import shot03 from '../assets/shot-03.webp'
import shot04 from '../assets/shot-04.webp'
import shot05 from '../assets/shot-05.webp'
import shot06 from '../assets/shot-06.webp'
import shotLogger from '../assets/shot-logger.webp'

export const SCREENSHOTS = {
  dashboardWeek: shot01,
  analytics: shot02,
  platforms: shot03,
  topDays: shot04,
  settings: shot05,
  dashboardDay: shot06,
  logger: shotLogger,
}

export function PhoneMockup({
  children,
  className = 'w-[280px] sm:w-[320px] animate-float',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <div className="relative aspect-[9/19.5] bg-[#0c0d0b] rounded-[44px] p-2 border border-white/10 shadow-[0_30px_80px_-15px_rgba(204,255,51,0.22),0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className="relative w-full h-full bg-bg rounded-[36px] overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[110px] h-[28px] bg-black rounded-b-[18px] z-20" />
          <div className="absolute inset-0 phone-glare z-30 rounded-[36px] pointer-events-none" />
          {children}
        </div>
      </div>
    </div>
  )
}

export function PhoneShot({
  src,
  alt,
  className,
  priority,
}: {
  src: string
  alt: string
  className?: string
  priority?: boolean
}) {
  return (
    <PhoneMockup className={className}>
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
      />
    </PhoneMockup>
  )
}
