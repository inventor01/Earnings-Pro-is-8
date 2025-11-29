import { useTheme } from '../lib/themeContext';
import { CountUpNumber } from './CountUpNumber';
import { Icons } from './Icons';
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

  const MetricCard = ({ icon: Icon, label, value, color, secondary, subtext, isNegative }: any) => {
    // Determine background color based on label
    const bgColorMap: { [key: string]: string } = {
      'Revenue': 'bg-lime-50 border-lime-400',
      'Expenses': 'bg-red-50 border-red-300',
      'Profit': 'bg-green-50 border-green-400',
      'Miles': 'bg-purple-50 border-purple-300',
      'Orders': 'bg-blue-50 border-blue-300',
      'Avg Order': 'bg-yellow-50 border-yellow-400'
    };
    
    const bgStyle = bgColorMap[label] || 'bg-lime-50 border-lime-400';
    
    return (
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
          
          @keyframes pulse-indicator {
            0%, 100% {
              transform: scaleX(1);
              opacity: 0.8;
            }
            50% {
              transform: scaleX(1.05);
              opacity: 1;
            }
          }
        `}</style>
        <div className={`relative p-4 md:p-5 lg:p-6 rounded-xl transition-all duration-300 group/card border-2 ${bgStyle} hover:shadow-lg hover:shadow-lime-300/30`}>
          {/* Top accent line - solid color */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-xl ${
            label === 'Revenue' ? 'bg-lime-500' :
            label === 'Expenses' ? 'bg-red-500' :
            label === 'Profit' ? 'bg-green-600' :
            label === 'Miles' ? 'bg-purple-500' :
            label === 'Orders' ? 'bg-blue-500' :
            'bg-yellow-500'
          }`} />
          
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 text-lime-600 drop-shadow-lg group-hover/card:scale-125 transition-transform">
                <Icon width="100%" height="100%" />
              </div>
              <div className={`text-xs md:text-sm lg:text-base font-bold uppercase tracking-wider leading-none ${
                label === 'Expenses' ? 'text-red-700' :
                label === 'Profit' ? 'text-green-700' :
                label === 'Miles' ? 'text-purple-700' :
                label === 'Orders' ? 'text-blue-700' :
                'text-green-700'
              }`}>{label}</div>
            </div>
            
            <div className="space-y-2">
              <div className={`text-4xl md:text-6xl lg:text-7xl font-black font-mono transition-all duration-300 group-hover/card:scale-110 cursor-pointer leading-none whitespace-nowrap overflow-hidden text-ellipsis ${
                isNegative ? 'text-red-600' : 'text-lime-700'
              }`}
              style={isNegative ? {
                animation: 'blink-red 0.8s ease-in-out infinite'
              } : {
                animation: 'subtle-glow 2s ease-in-out infinite',
                filter: 'drop-shadow(0 0 8px rgba(132, 204, 22, 0.3))'
              }}>
                <CountUpNumber value={value} />
              </div>
              
              {/* Visual indicator bar */}
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${
                    label === 'Revenue' ? 'bg-lime-500' :
                    label === 'Expenses' ? 'bg-red-500' :
                    label === 'Profit' ? 'bg-green-600' :
                    label === 'Miles' ? 'bg-purple-500' :
                    label === 'Orders' ? 'bg-blue-500' :
                    'bg-yellow-500'
                  }`}
                  style={{
                    width: '75%',
                    animation: 'pulse-indicator 2s ease-in-out infinite'
                  }}
                />
              </div>
              
              {subtext && (
                <div className="text-xs md:text-sm lg:text-base font-medium text-gray-700">
                  {subtext}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

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
        <div className="text-xs md:text-sm font-bold uppercase tracking-widest text-gray-700 opacity-80 font-mono">
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
                    className="p-1.5 md:p-2 rounded-lg transition-all bg-lime-500 text-white hover:bg-lime-600 font-bold text-sm md:text-base"
                    title="Previous day"
                  >
                    ←
                  </button>
                  <div className="px-3 py-1 md:px-4 md:py-1.5 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap bg-lime-200 text-green-900 border border-lime-500">
                    {getDateLabel(dayOffset)}
                  </div>
                  <button
                    onClick={() => onDayChange(dayOffset + 1)}
                    className="p-1.5 md:p-2 rounded-lg transition-all bg-lime-500 text-white hover:bg-lime-600 font-bold text-sm md:text-base"
                    title="Next day"
                  >
                    →
                  </button>
                </>
              )}
              {!showDayNav && periodLabel && (
                <div className="px-3 py-1 md:px-4 md:py-1.5 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap bg-lime-200 text-green-900 border border-lime-500">
                  {periodLabel}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid - Shopify Style */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
        {/* Revenue */}
        {visibility.revenue && (
          <MetricCard
            icon={Icons.Revenue}
            label="Revenue"
            value={revenue}
            color="from-blue-500 to-blue-400"
            secondary={colorConfig.accent}
          />
        )}

        {/* Expenses */}
        {visibility.expenses && (
          <MetricCard
            icon={Icons.Expenses}
            label="Expenses"
            value={expenses}
            color="from-red-500 to-red-400"
            secondary={themeConfig.kpiColors['red'].accent}
          />
        )}

        {/* Profit */}
        {visibility.profit && (
          <MetricCard
            icon={Icons.Profit}
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
            icon={Icons.Miles}
            label="Miles"
            value={miles}
            color="from-purple-500 to-purple-400"
            secondary={themeConfig.kpiColors['purple'].accent}
          />
        )}

        {/* Orders */}
        {visibility.orders && (
          <MetricCard
            icon={Icons.Orders}
            label="Orders"
            value={orders.toString()}
            color="from-cyan-500 to-cyan-400"
            secondary={themeConfig.kpiColors['green'].accent}
          />
        )}

        {/* Avg Order */}
        {visibility.avgOrder && avgOrder && (
          <MetricCard
            icon={Icons.AvgOrder}
            label="Avg Order"
            value={avgOrder}
            color="from-yellow-500 to-yellow-400"
            secondary="text-yellow-900"
          />
        )}
      </div>
      
      {/* Share Button */}
      {onShare && (
        <div className="mt-3 md:mt-4 flex justify-center">
          <button
            onClick={onShare}
            className="px-3 py-1 rounded-lg transition-all text-xs md:text-sm font-medium opacity-70 hover:opacity-100 text-lime-600 hover:text-lime-700 hover:bg-lime-100 flex items-center gap-1"
            title="Share performance"
          >
            <Icons.Share2 width={16} height={16} />
            Share
          </button>
        </div>
      )}
    </div>
  );
}
