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
  hideData?: boolean;
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
  onShare,
  hideData = false
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

  const getMaskedValue = (val: string | number): string => {
    if (hideData) return '***';
    return String(val);
  };

  const MetricCard = ({ icon: Icon, label, value, color, secondary, subtext, isNegative }: any) => {
    // Determine colors based on label and theme
    const lightColorMap: { [key: string]: { icon: string; accent: string; bg: string; shadow: string } } = {
      'Revenue': { icon: 'text-lime-600', accent: 'text-lime-700', bg: 'bg-gradient-to-br from-white to-lime-50', shadow: 'hover:shadow-lg hover:shadow-lime-500/20' },
      'Expenses': { icon: 'text-red-600', accent: 'text-red-700', bg: 'bg-gradient-to-br from-white to-red-50', shadow: 'hover:shadow-lg hover:shadow-red-500/20' },
      'Profit': { icon: 'text-green-600', accent: 'text-green-700', bg: 'bg-gradient-to-br from-white to-green-50', shadow: 'hover:shadow-lg hover:shadow-green-500/20' },
      'Miles': { icon: 'text-purple-600', accent: 'text-purple-700', bg: 'bg-gradient-to-br from-white to-purple-50', shadow: 'hover:shadow-lg hover:shadow-purple-500/20' },
      'Orders': { icon: 'text-blue-600', accent: 'text-blue-700', bg: 'bg-gradient-to-br from-white to-blue-50', shadow: 'hover:shadow-lg hover:shadow-blue-500/20' },
      'Avg Order': { icon: 'text-yellow-600', accent: 'text-yellow-700', bg: 'bg-gradient-to-br from-white to-yellow-50', shadow: 'hover:shadow-lg hover:shadow-yellow-500/20' }
    };

    const darkColorMap: { [key: string]: { icon: string; accent: string; bg: string; shadow: string } } = {
      'Revenue': { icon: 'text-lime-400', accent: 'text-lime-300', bg: 'bg-gradient-to-br from-slate-900/80 via-slate-850 to-slate-800', shadow: 'hover:shadow-2xl hover:shadow-lime-500/30' },
      'Expenses': { icon: 'text-red-400', accent: 'text-red-300', bg: 'bg-gradient-to-br from-slate-900/80 via-slate-850 to-slate-800', shadow: 'hover:shadow-2xl hover:shadow-red-500/30' },
      'Profit': { icon: 'text-green-400', accent: 'text-green-300', bg: 'bg-gradient-to-br from-slate-900/80 via-slate-850 to-slate-800', shadow: 'hover:shadow-2xl hover:shadow-green-500/30' },
      'Miles': { icon: 'text-purple-400', accent: 'text-purple-300', bg: 'bg-gradient-to-br from-slate-900/80 via-slate-850 to-slate-800', shadow: 'hover:shadow-2xl hover:shadow-purple-500/30' },
      'Orders': { icon: 'text-blue-400', accent: 'text-blue-300', bg: 'bg-gradient-to-br from-slate-900/80 via-slate-850 to-slate-800', shadow: 'hover:shadow-2xl hover:shadow-blue-500/30' },
      'Avg Order': { icon: 'text-yellow-400', accent: 'text-yellow-300', bg: 'bg-gradient-to-br from-slate-900/80 via-slate-850 to-slate-800', shadow: 'hover:shadow-2xl hover:shadow-yellow-500/30' }
    };
    
    const colorMap = isDarkTheme ? darkColorMap : lightColorMap;
    const colors = colorMap[label] || colorMap['Revenue'];
    
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

          .metric-card-pattern {
            background-image: 
              radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px);
            background-size: 20px 20px;
            background-position: 0 0, 10px 10px;
          }

          .dark-metric-card {
            box-shadow: 
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              0 0 20px rgba(0, 0, 0, 0.3),
              0 0 40px var(--glow-color);
          }

          .dark-metric-card.glow-lime {
            --glow-color: rgba(132, 204, 22, 0.15);
          }

          .dark-metric-card.glow-red {
            --glow-color: rgba(239, 68, 68, 0.15);
          }

          .dark-metric-card.glow-green {
            --glow-color: rgba(34, 197, 94, 0.15);
          }

          .dark-metric-card.glow-purple {
            --glow-color: rgba(147, 51, 234, 0.15);
          }

          .dark-metric-card.glow-blue {
            --glow-color: rgba(59, 130, 246, 0.15);
          }

          .dark-metric-card.glow-yellow {
            --glow-color: rgba(202, 138, 4, 0.15);
          }
        `}</style>
        <div className={`relative p-5 md:p-6 lg:p-7 rounded-2xl transition-all duration-300 group/card ${colors.bg} ${
          isDarkTheme 
            ? `border border-slate-700/50 ${colors.shadow} dark-metric-card ${
              label === 'Revenue' ? 'glow-lime' :
              label === 'Expenses' ? 'glow-red' :
              label === 'Profit' ? 'glow-green' :
              label === 'Miles' ? 'glow-purple' :
              label === 'Orders' ? 'glow-blue' :
              'glow-yellow'
            }`
            : `border border-gray-200/50 ${colors.shadow}`
        } backdrop-blur-sm overflow-hidden`}>
          <div className="metric-card-pattern absolute inset-0 rounded-2xl pointer-events-none" />
          
          {/* Accent line at top */}
          <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl z-10 ${
            label === 'Revenue' ? 'bg-lime-500' :
            label === 'Expenses' ? 'bg-red-500' :
            label === 'Profit' ? 'bg-green-600' :
            label === 'Miles' ? 'bg-purple-500' :
            label === 'Orders' ? 'bg-blue-500' :
            'bg-yellow-500'
          }`} />
          
          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className={`w-14 h-14 md:w-16 md:h-16 lg:w-18 lg:h-18 ${colors.icon} group-hover/card:scale-110 group-hover/card:rotate-6 transition-all duration-300`}>
                <Icon width="100%" height="100%" strokeWidth={1.5} />
              </div>
              <div className={`text-xs md:text-sm lg:text-base font-semibold uppercase tracking-wide ${colors.accent} opacity-90`}>{label}</div>
            </div>
            
            <div className="space-y-2.5">
              <div className={`text-4xl md:text-6xl lg:text-7xl font-black font-mono transition-all duration-300 group-hover/card:scale-105 cursor-pointer leading-tight whitespace-nowrap overflow-hidden text-ellipsis ${
                isNegative ? 'text-red-600' : colors.accent
              }`}
              style={isNegative ? {
                animation: 'blink-red 0.8s ease-in-out infinite'
              } : {
                animation: 'subtle-glow 2s ease-in-out infinite',
                filter: `drop-shadow(0 0 12px ${
                  label === 'Revenue' ? 'rgba(132, 204, 22, 0.6)' :
                  label === 'Expenses' ? 'rgba(239, 68, 68, 0.5)' :
                  label === 'Profit' ? 'rgba(34, 197, 94, 0.6)' :
                  label === 'Miles' ? 'rgba(147, 51, 234, 0.5)' :
                  label === 'Orders' ? 'rgba(59, 130, 246, 0.5)' :
                  'rgba(202, 138, 4, 0.5)'
                }) drop-shadow(0 0 24px ${
                  label === 'Revenue' ? 'rgba(132, 204, 22, 0.3)' :
                  label === 'Expenses' ? 'rgba(239, 68, 68, 0.2)' :
                  label === 'Profit' ? 'rgba(34, 197, 94, 0.3)' :
                  label === 'Miles' ? 'rgba(147, 51, 234, 0.2)' :
                  label === 'Orders' ? 'rgba(59, 130, 246, 0.2)' :
                  'rgba(202, 138, 4, 0.2)'
                })`
              }}>
                {hideData ? '***' : <CountUpNumber value={value} />}
              </div>
              
              {/* Modern indicator bar */}
              <div className="h-1.5 bg-gray-200/60 rounded-full overflow-hidden">
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
                <div className="text-xs md:text-sm font-medium text-gray-600 pt-1">
                  {hideData ? '***' : subtext}
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
            className="px-3 py-1 rounded-lg transition-all text-xs md:text-sm font-medium opacity-70 hover:opacity-100 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-100 flex items-center gap-1"
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
