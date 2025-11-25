import { useTheme } from '../lib/themeContext';
import { CountUpNumber } from './CountUpNumber';
import { useRef, useState } from 'react';

interface SummaryCardProps {
  revenue: string;
  expenses: string;
  profit: string;
  miles: string;
  orders: number;
  margin: string;
  avgOrder?: string;
  dayOffset?: number;
  onDayChange?: (offset: number) => void;
  getDateLabel?: (offset: number) => string;
  isDarkTheme?: boolean;
  showDayNav?: boolean;
  periodLabel?: string;
}

export function SummaryCard({ 
  revenue, expenses, profit, miles, orders, margin, avgOrder,
  dayOffset = 0,
  onDayChange,
  getDateLabel,
  isDarkTheme = true,
  showDayNav = false,
  periodLabel
}: SummaryCardProps) {
  const { config: themeConfig } = useTheme();
  const colorConfig = themeConfig.kpiColors['blue'];
  
  // Swipe detection for mobile day navigation
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!showDayNav || !onDayChange) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!showDayNav || !onDayChange || touchStartX.current === null || touchStartY.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - touchEndX;
    const diffY = touchStartY.current - touchEndY;
    const minSwipeDistance = 50; // Minimum pixels to register as swipe
    
    // Only treat as horizontal swipe if horizontal movement > vertical movement
    if (Math.abs(diffX) < minSwipeDistance || Math.abs(diffY) > Math.abs(diffX)) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    
    // Prevent default scrolling/zooming behavior only for horizontal swipes
    e.preventDefault();
    
    setIsTransitioning(true);
    if (diffX > 0) {
      // Swiped left - go to next day
      onDayChange(dayOffset + 1);
    } else {
      // Swiped right - go to previous day
      onDayChange(dayOffset - 1);
    }
    
    setTimeout(() => setIsTransitioning(false), 300);
    touchStartX.current = null;
    touchStartY.current = null;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!showDayNav || touchStartX.current === null || touchStartY.current === null) return;
    
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const diffX = Math.abs(touchStartX.current - currentX);
    const diffY = Math.abs(touchStartY.current - currentY);
    
    // Only prevent default if it's clearly a horizontal swipe
    if (diffX > diffY && diffX > 10) {
      e.preventDefault();
    }
  };

  return (
    <div 
      className={`w-full relative p-6 md:p-8 rounded-2xl overflow-hidden group mb-6 transition-opacity ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: showDayNav ? 'grab' : 'default' }}
    >
      {/* Background with dark dashboard effect */}
      <div className={`absolute inset-0 ${colorConfig.bg} border-2 ${colorConfig.border} rounded-2xl`} />
      <div className={`absolute inset-0 bg-gradient-to-br ${colorConfig.glow} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />
      
      {/* Gauge arc effect */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colorConfig.glow} rounded-full opacity-60`} />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className={`text-sm font-bold uppercase tracking-widest ${colorConfig.accent} opacity-80 font-mono`}>
            Performance Overview
          </div>
          
          {/* Date/Period Display with Navigation */}
          {(showDayNav || periodLabel) && (
            <div className="flex items-center gap-2">
              {showDayNav && onDayChange && getDateLabel && (
                <>
                  <button
                    onClick={() => onDayChange(dayOffset - 1)}
                    className={`p-1.5 md:p-2 rounded-lg transition-all ${
                      isDarkTheme
                        ? 'bg-gradient-to-r from-blue-900 to-blue-800 text-cyan-400 hover:from-blue-800 hover:to-blue-700 hover:shadow-lg hover:shadow-cyan-500/20'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    } font-bold text-sm md:text-base`}
                    title="Previous day"
                  >
                    ←
                  </button>
                  <div className={`px-3 py-1 md:px-4 md:py-1.5 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap ${
                    isDarkTheme
                      ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-cyan-300 border border-cyan-500/30'
                      : 'bg-gray-100 text-gray-800 border border-gray-300'
                  }`}>
                    {getDateLabel(dayOffset)}
                  </div>
                  <button
                    onClick={() => onDayChange(dayOffset + 1)}
                    className={`p-1.5 md:p-2 rounded-lg transition-all ${
                      isDarkTheme
                        ? 'bg-gradient-to-r from-blue-900 to-blue-800 text-cyan-400 hover:from-blue-800 hover:to-blue-700 hover:shadow-lg hover:shadow-cyan-500/20'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    } font-bold text-sm md:text-base`}
                    title="Next day"
                  >
                    →
                  </button>
                </>
              )}
              {!showDayNav && periodLabel && (
                <div className={`px-3 py-1 md:px-4 md:py-1.5 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap ${
                  isDarkTheme
                    ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-cyan-300 border border-cyan-500/30'
                    : 'bg-gray-100 text-gray-800 border border-gray-300'
                }`}>
                  {periodLabel}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4 lg:gap-6">
          {/* Revenue */}
          <div className="space-y-1 p-2 md:p-3 rounded-lg transition-all duration-300 hover:bg-white/5">
            <div className={`text-xs md:text-sm font-bold uppercase tracking-wider ${colorConfig.accent}`} style={{ fontFamily: "'Poppins', sans-serif" }}>💰 Revenue</div>
            <div className={`text-xl md:text-3xl lg:text-4xl font-black ${colorConfig.accent} font-mono transition-all duration-300 hover:scale-110 cursor-pointer whitespace-nowrap`}>
              <CountUpNumber value={revenue} />
            </div>
          </div>

          {/* Expenses */}
          <div className="space-y-1 p-2 md:p-3 rounded-lg transition-all duration-300 hover:bg-white/5">
            <div className={`text-xs md:text-sm font-bold uppercase tracking-wider ${themeConfig.kpiColors['red'].accent}`} style={{ fontFamily: "'Poppins', sans-serif" }}>💸 Expenses</div>
            <div className={`text-xl md:text-3xl lg:text-4xl font-black ${themeConfig.kpiColors['red'].accent} font-mono transition-all duration-300 hover:scale-110 cursor-pointer whitespace-nowrap`}>
              <CountUpNumber value={expenses} />
            </div>
          </div>

          {/* Profit */}
          <div className="space-y-1 p-2 md:p-3 rounded-lg transition-all duration-300 hover:bg-white/5">
            <div className={`text-xs md:text-sm font-bold uppercase tracking-wider ${themeConfig.kpiColors['green'].accent}`} style={{ fontFamily: "'Poppins', sans-serif" }}>🎯 Profit</div>
            <div className={`text-xl md:text-3xl lg:text-4xl font-black ${themeConfig.kpiColors['green'].accent} font-mono transition-all duration-300 hover:scale-110 cursor-pointer whitespace-nowrap`}>
              <CountUpNumber value={profit} />
            </div>
            <div className={`text-xs ${themeConfig.kpiColors['green'].accent}`}>Margin: {margin}</div>
          </div>

          {/* Miles */}
          <div className="space-y-1 p-2 md:p-3 rounded-lg transition-all duration-300 hover:bg-white/5">
            <div className={`text-xs md:text-sm font-bold uppercase tracking-wider ${themeConfig.kpiColors['purple'].accent}`} style={{ fontFamily: "'Poppins', sans-serif" }}>🛣️ Miles</div>
            <div className={`text-xl md:text-3xl lg:text-4xl font-black ${themeConfig.kpiColors['purple'].accent} font-mono transition-all duration-300 hover:scale-110 cursor-pointer whitespace-nowrap`}>
              <CountUpNumber value={miles} />
            </div>
          </div>

          {/* Orders */}
          <div className="space-y-1 p-2 md:p-3 rounded-lg transition-all duration-300 hover:bg-white/5">
            <div className={`text-xs md:text-sm font-bold uppercase tracking-wider ${themeConfig.kpiColors['green'].accent}`} style={{ fontFamily: "'Poppins', sans-serif" }}>📦 Orders</div>
            <div className={`text-xl md:text-3xl lg:text-4xl font-black ${themeConfig.kpiColors['green'].accent} font-mono transition-all duration-300 hover:scale-110 cursor-pointer whitespace-nowrap`}>
              <CountUpNumber value={orders} />
            </div>
          </div>

          {/* Avg Order */}
          {avgOrder && (
            <div className="space-y-1 p-2 md:p-3 rounded-lg transition-all duration-300 hover:bg-white/5">
              <div className={`text-xs md:text-sm font-bold uppercase tracking-wider ${colorConfig.accent}`} style={{ fontFamily: "'Poppins', sans-serif" }}>📊 Avg Order</div>
              <div className={`text-xl md:text-3xl lg:text-4xl font-black ${colorConfig.accent} font-mono transition-all duration-300 hover:scale-110 cursor-pointer whitespace-nowrap`}>
                <CountUpNumber value={avgOrder} />
              </div>
            </div>
          )}
        </div>
        
        {/* Bottom accent line */}
        <div className={`h-0.5 bg-gradient-to-r ${colorConfig.glow} opacity-50 mt-6 rounded-full`} />
      </div>
    </div>
  );
}
