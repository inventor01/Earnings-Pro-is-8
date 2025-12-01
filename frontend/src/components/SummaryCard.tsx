import { useTheme } from '../lib/themeContext';
import { CountUpNumber } from './CountUpNumber';
import { Icons } from './Icons';
import { useRef, useState, useEffect } from 'react';

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
  
  // Parse profit to check if negative early for sound effect
  const profitValue = parseFloat(profit.replace('$', '').replace(',', ''));
  const isProfitNegative = profitValue < 0;
  
  // Sound effect for negative account
  const soundPlayedRef = useRef(false);
  
  useEffect(() => {
    if (isProfitNegative && !soundPlayedRef.current) {
      soundPlayedRef.current = true;
      try {
        const audio = new Audio('/sounds/negative-account.wav');
        audio.play().catch(err => console.log('Sound playback prevented:', err));
      } catch (err) {
        console.log('Sound effect error:', err);
      }
    } else if (!isProfitNegative) {
      soundPlayedRef.current = false;
    }
  }, [isProfitNegative]);
  
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
      'Revenue': { icon: 'text-lime-600', accent: 'text-lime-700', bg: 'metric-gradient-lime', shadow: 'shadow-none' },
      'Expenses': { icon: 'text-red-600', accent: 'text-red-700', bg: 'metric-gradient-red', shadow: 'shadow-none' },
      'Profit': { icon: 'text-green-600', accent: 'text-green-700', bg: 'metric-gradient-green', shadow: 'shadow-none' },
      'Miles': { icon: 'text-purple-600', accent: 'text-purple-700', bg: 'metric-gradient-purple', shadow: 'shadow-none' },
      'Orders': { icon: 'text-blue-600', accent: 'text-blue-700', bg: 'metric-gradient-blue', shadow: 'shadow-none' },
      'Avg Order': { icon: 'text-yellow-600', accent: 'text-yellow-700', bg: 'metric-gradient-yellow', shadow: 'shadow-none' }
    };

    const darkColorMap: { [key: string]: { icon: string; accent: string; bg: string; shadow: string } } = {
      'Revenue': { icon: 'text-lime-400', accent: 'text-lime-300', bg: 'metric-dark-gradient-lime', shadow: 'hover:shadow-2xl hover:shadow-lime-500/40' },
      'Expenses': { icon: 'text-red-400', accent: 'text-red-300', bg: 'metric-dark-gradient-red', shadow: 'hover:shadow-2xl hover:shadow-red-500/40' },
      'Profit': { icon: 'text-green-400', accent: 'text-green-300', bg: 'metric-dark-gradient-green', shadow: 'hover:shadow-2xl hover:shadow-green-500/40' },
      'Miles': { icon: 'text-purple-400', accent: 'text-purple-300', bg: 'metric-dark-gradient-purple', shadow: 'hover:shadow-2xl hover:shadow-purple-500/40' },
      'Orders': { icon: 'text-blue-400', accent: 'text-blue-300', bg: 'metric-dark-gradient-blue', shadow: 'hover:shadow-2xl hover:shadow-blue-500/40' },
      'Avg Order': { icon: 'text-yellow-400', accent: 'text-yellow-300', bg: 'metric-dark-gradient-yellow', shadow: 'hover:shadow-2xl hover:shadow-yellow-500/40' }
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

          @keyframes shimmer {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 1.05;
            }
          }

          @keyframes float-wobble {
            0%, 100% {
              transform: translateY(0px) rotate(0deg);
            }
            50% {
              transform: translateY(-4px) rotate(1deg);
            }
          }

          @keyframes icon-pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.08);
            }
          }

          @keyframes border-glow {
            0%, 100% {
              border-color: currentColor;
              box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
            }
            50% {
              box-shadow: 0 0 12px 0 rgba(255, 255, 255, 0.1);
            }
          }

          /* Light gradients - Subtle, matching eggshell theme */
          .metric-gradient-lime {
            background: #fafaf7;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }
          .metric-gradient-red {
            background: #fafaf7;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }
          .metric-gradient-green {
            background: #fafaf7;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }
          .metric-gradient-purple {
            background: #fafaf7;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }
          .metric-gradient-blue {
            background: #fafaf7;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }
          .metric-gradient-yellow {
            background: #fafaf7;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }

          /* Dark gradients - Enhanced with color-coded depth */
          .metric-dark-gradient-lime {
            background: linear-gradient(135deg, #1a2332 0%, #0f172a 50%, #1a3a1a 100%);
          }
          .metric-dark-gradient-red {
            background: linear-gradient(135deg, #1a2332 0%, #0f172a 50%, #3a1a1a 100%);
          }
          .metric-dark-gradient-green {
            background: linear-gradient(135deg, #1a2332 0%, #0f172a 50%, #1a3a2a 100%);
          }
          .metric-dark-gradient-purple {
            background: linear-gradient(135deg, #1a2332 0%, #0f172a 50%, #2a1a3a 100%);
          }
          .metric-dark-gradient-blue {
            background: linear-gradient(135deg, #1a2332 0%, #0f172a 50%, #1a2a3a 100%);
          }
          .metric-dark-gradient-yellow {
            background: linear-gradient(135deg, #1a2332 0%, #0f172a 50%, #3a3a1a 100%);
          }

          .metric-card-pattern {
            background-image: 
              radial-gradient(circle at 20% 50%, rgba(255,255,255,0.08) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(255,255,255,0.04) 0%, transparent 50%);
            background-size: 200% 200%;
          }

          .dark-metric-card {
            box-shadow: 
              inset 0 1px 0 rgba(255, 255, 255, 0.15),
              inset 0 -1px 0 rgba(0, 0, 0, 0.3),
              0 10px 30px rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.08);
          }

          .dark-metric-card.glow-lime {
            --glow-color: rgba(132, 204, 22, 0.25);
          }

          .dark-metric-card.glow-red {
            --glow-color: rgba(239, 68, 68, 0.25);
          }

          .dark-metric-card.glow-green {
            --glow-color: rgba(34, 197, 94, 0.25);
          }

          .dark-metric-card.glow-purple {
            --glow-color: rgba(147, 51, 234, 0.25);
          }

          .dark-metric-card.glow-blue {
            --glow-color: rgba(59, 130, 246, 0.25);
          }

          .dark-metric-card.glow-yellow {
            --glow-color: rgba(202, 138, 4, 0.25);
          }

          .metric-card-hover {
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          .metric-card-hover:hover {
            transform: translateY(-12px) perspective(1000px) rotateX(2deg);
          }
        `}</style>
        <div className={`relative p-6 md:p-8 lg:p-10 rounded-2xl transition-all duration-400 group/card ${colors.bg} ${
          isDarkTheme 
            ? `${colors.shadow} dark-metric-card metric-card-hover ${
              label === 'Revenue' ? 'glow-lime' :
              label === 'Expenses' ? 'glow-red' :
              label === 'Profit' ? 'glow-green' :
              label === 'Miles' ? 'glow-purple' :
              label === 'Orders' ? 'glow-blue' :
              'glow-yellow'
            }`
            : `border-2 border-transparent transition-all`
        } backdrop-blur-md overflow-hidden`}>
          {isDarkTheme && <div className="metric-card-pattern absolute inset-0 rounded-2xl pointer-events-none" />}
          
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
              <div className={`w-14 h-14 md:w-16 md:h-16 lg:w-18 lg:h-18 ${colors.icon} group-hover/card:scale-125 group-hover/card:rotate-12 transition-all duration-400 animate-[float-wobble_4s_ease-in-out_infinite]`} style={{animationDelay: '0.1s'}}>
                <Icon width="100%" height="100%" strokeWidth={1.5} />
              </div>
              <div className={`text-xs md:text-sm lg:text-base font-semibold uppercase tracking-wide ${colors.accent} opacity-90`}>{label}</div>
            </div>
            
            <div className="space-y-2.5">
              <div className={`text-4xl md:text-6xl lg:text-7xl font-black font-mono transition-all duration-300 group-hover/card:scale-105 cursor-pointer leading-tight whitespace-nowrap overflow-hidden text-ellipsis ${
                isNegative ? 'text-red-600' : colors.accent
              } ${parseFloat(value.toString().replace('$', '').replace(',', '')) === 0 ? 'text-center' : ''}`}
              style={isNegative ? {
                animation: 'blink-red 0.8s ease-in-out infinite'
              } : {}}>
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

  return (
    <div 
      className={`w-full relative transition-opacity mb-8 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: showDayNav ? 'grab' : 'default' }}
    >
      {/* Metrics Grid - Enhanced with better spacing */}
      <div className="relative">
        {/* Left Arrow Indicator - Overlapping */}
        {showDayNav && (
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 text-3xl md:text-4xl lg:text-5xl transition-all duration-300 pointer-events-none ${
            isDarkTheme ? 'text-lime-500/50' : 'text-lime-600/50'
          }`}>
            ←
          </div>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-5 lg:gap-6">
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
        
        {/* Right Arrow Indicator - Overlapping */}
        {showDayNav && (
          <div className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 text-3xl md:text-4xl lg:text-5xl transition-all duration-300 pointer-events-none ${
            isDarkTheme ? 'text-lime-500/50' : 'text-lime-600/50'
          }`}>
            →
          </div>
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
