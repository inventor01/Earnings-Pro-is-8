import { useTheme } from '../lib/themeContext';
import { CountUpNumber } from './CountUpNumber';
import { useRef, useState } from 'react';

export interface MetricVisibility {
  revenue: boolean;
  expenses: boolean;
  profit: boolean;
  miles: boolean;
  orders: boolean;
  avgOrder: boolean;
}

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
  visibilityConfig?: Partial<MetricVisibility>;
  onShare?: () => void;
}

export function SummaryCard({ 
  revenue, expenses, profit, miles, orders, margin, avgOrder,
  dayOffset = 0,
  onDayChange,
  getDateLabel,
  isDarkTheme = true,
  showDayNav = false,
  periodLabel,
  visibilityConfig = {},
  onShare
}: SummaryCardProps) {
  const { config: themeConfig } = useTheme();
  const colorConfig = themeConfig.kpiColors['blue'];
  
  // Default visibility - all metrics shown by default
  const visibility: MetricVisibility = {
    revenue: visibilityConfig.revenue !== false,
    expenses: visibilityConfig.expenses !== false,
    profit: visibilityConfig.profit !== false,
    miles: visibilityConfig.miles !== false,
    orders: visibilityConfig.orders !== false,
    avgOrder: visibilityConfig.avgOrder !== false,
  };
  
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

  const MetricCard = ({ icon, label, value, color, secondary, subtext, isNegative }: any) => (
    <>
      <style>{`
        @keyframes blink-red {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.8));
            opacity: 1;
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(239, 68, 68, 1));
            opacity: 0.7;
          }
        }
        
        @keyframes subtle-glow {
          0%, 100% {
            filter: drop-shadow(0 0 2px rgba(34, 211, 238, 0.15));
            text-shadow: 0 0 4px rgba(34, 211, 238, 0.1);
          }
          50% {
            filter: drop-shadow(0 0 4px rgba(34, 211, 238, 0.25));
            text-shadow: 0 0 6px rgba(34, 211, 238, 0.15);
          }
        }
      `}</style>
      <div className={`relative p-4 md:p-5 lg:p-6 rounded-xl transition-all duration-300 group/card ${
        themeConfig.name === 'dark-neon'
          ? 'bg-slate-800 border border-slate-700/50 hover:border-slate-600/80 hover:shadow-lg hover:shadow-slate-900/50'
          : themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green'
          ? 'bg-white border border-lime-500 hover:border-lime-600 hover:shadow-md hover:shadow-lime-300/50'
          : 'bg-slate-800 border border-slate-700/50 hover:border-slate-600 hover:shadow-lg'
      }`}>
        {/* Top accent line */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r rounded-t-xl opacity-50 ${color}`} />
        
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className={`text-2xl md:text-3xl lg:text-4xl`}>{icon}</div>
            <div className={`text-xs md:text-sm lg:text-base font-bold uppercase tracking-wider opacity-70 leading-none ${
              themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green' ? 'text-gray-600' : 'text-slate-400'
            }`}>{label}</div>
          </div>
          
          <div className="space-y-1">
            <div className={`text-3xl md:text-5xl lg:text-6xl font-black font-mono transition-all duration-300 group-hover/card:scale-105 cursor-pointer leading-none whitespace-nowrap overflow-hidden text-ellipsis ${
              isNegative ? 'text-red-500' : secondary
            }`}
            style={isNegative ? {
              animation: 'blink-red 0.8s ease-in-out infinite'
            } : {
              animation: 'subtle-glow 2s ease-in-out infinite'
            }}>
              <CountUpNumber value={value} />
            </div>
            
            {subtext && (
              <div className={`text-xs md:text-sm lg:text-base font-medium opacity-75 ${
                themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green' ? 'text-gray-500' : 'text-slate-400'
              }`}>
                {subtext}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // Parse profit to check if negative
  const profitValue = parseFloat(profit.replace('$', '').replace(',', ''));
  const isProfitNegative = profitValue < 0;

  return (
    <div 
      className={`w-full relative transition-opacity mb-8 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: showDayNav ? 'grab' : 'default' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-4 px-2">
        <div className={`text-xs md:text-sm font-bold uppercase tracking-widest ${
          themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green' ? 'text-gray-700' : 'text-slate-400'
        } opacity-80 font-mono`}>
          Performance Overview
        </div>
        
        {/* Date/Period Display with Navigation */}
        <div className="flex items-center gap-2">
          {(showDayNav || periodLabel) && (
            <div className="flex items-center gap-2">
              {showDayNav && onDayChange && getDateLabel && (
                <>
                  <button
                    onClick={() => onDayChange(dayOffset - 1)}
                    className={`p-1.5 md:p-2 rounded-lg transition-all ${
                      isDarkTheme
                        ? 'bg-lime-700 text-lime-100 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20'
                        : 'bg-lime-500 text-white hover:bg-lime-600'
                    } font-bold text-sm md:text-base`}
                    title="Previous day"
                  >
                    ←
                  </button>
                  <div className={`px-3 py-1 md:px-4 md:py-1.5 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap ${
                    isDarkTheme
                      ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-lime-300 border border-lime-500/30'
                      : 'bg-lime-200 text-green-900 border border-lime-500'
                  }`}>
                    {getDateLabel(dayOffset)}
                  </div>
                  <button
                    onClick={() => onDayChange(dayOffset + 1)}
                    className={`p-1.5 md:p-2 rounded-lg transition-all ${
                      isDarkTheme
                        ? 'bg-lime-700 text-lime-100 hover:bg-lime-600 hover:shadow-lg hover:shadow-lime-500/20'
                        : 'bg-lime-500 text-white hover:bg-lime-600'
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
                    ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-lime-300 border border-lime-500/30'
                    : 'bg-lime-200 text-green-900 border border-lime-500'
                }`}>
                  {periodLabel}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid - Shopify Style */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-3">
        {/* Revenue */}
        {visibility.revenue && (
          <MetricCard
            icon="💰"
            label="Revenue"
            value={revenue}
            color="from-blue-500 to-blue-400"
            secondary={colorConfig.accent}
          />
        )}

        {/* Expenses */}
        {visibility.expenses && (
          <MetricCard
            icon="💸"
            label="Expenses"
            value={expenses}
            color="from-red-500 to-red-400"
            secondary={themeConfig.kpiColors['red'].accent}
          />
        )}

        {/* Profit */}
        {visibility.profit && (
          <MetricCard
            icon="🎯"
            label="Profit"
            value={profit}
            color="from-green-500 to-green-400"
            secondary={themeConfig.kpiColors['green'].accent}
            subtext={`Margin: ${margin}`}
            isNegative={isProfitNegative}
          />
        )}

        {/* Miles */}
        {visibility.miles && (
          <MetricCard
            icon="🛣️"
            label="Miles"
            value={miles}
            color="from-purple-500 to-purple-400"
            secondary={themeConfig.kpiColors['purple'].accent}
          />
        )}

        {/* Orders */}
        {visibility.orders && (
          <MetricCard
            icon="📦"
            label="Orders"
            value={orders.toString()}
            color="from-cyan-500 to-cyan-400"
            secondary={themeConfig.kpiColors['green'].accent}
          />
        )}

        {/* Avg Order */}
        {visibility.avgOrder && avgOrder && (
          <MetricCard
            icon="📊"
            label="Avg Order"
            value={avgOrder}
            color="from-yellow-500 to-yellow-400"
            secondary={themeConfig.name === 'ninja-green' ? 'text-yellow-900' : colorConfig.accent}
          />
        )}
      </div>
      
      {/* Share Button */}
      {onShare && (
        <div className="mt-3 md:mt-4 flex justify-center">
          <button
            onClick={onShare}
            className={`px-3 py-1 rounded-lg transition-all text-xs md:text-sm font-medium opacity-70 hover:opacity-100 ${
              themeConfig.name === 'dark-neon'
                ? 'text-lime-400 hover:text-lime-300 hover:bg-lime-700'
                : themeConfig.name === 'simple-light' || themeConfig.name === 'ninja-green'
                ? 'text-lime-600 hover:text-lime-700 hover:bg-lime-100'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
            title="Share performance"
          >
            🔗 Share
          </button>
        </div>
      )}
    </div>
  );
}
