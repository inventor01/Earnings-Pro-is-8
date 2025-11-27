import { useTheme } from '../lib/themeContext';
import { CountUpNumber } from './CountUpNumber';

const ICON_MAP: Record<string, string> = {
  'Revenue': '💰',
  'Expenses': '💸',
  'Profit': '🎯',
  'Miles': '🛣️',
  '$/Mile': '📍',
  '$/Hour': '⏱️',
  'Avg Order': '📊'
};

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  detail1?: { label: string; value: string | number };
  detail2?: { label: string; value: string | number };
  trend?: string;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'gray';
  goalProgress?: number | null;
  goalTarget?: number | null;
}

export function KpiCard({ title, value, subtitle, detail1, detail2, trend, color = 'blue' }: KpiCardProps) {
  const { config: themeConfig } = useTheme();
  const colorConfig = themeConfig.kpiColors[color];

  const glowClass = 
    color === 'green' ? 'pulse-glow-green' :
    color === 'red' ? 'pulse-glow-red' :
    color === 'purple' ? 'pulse-glow-purple' :
    color === 'orange' ? 'pulse-glow-orange' :
    'pulse-glow';

  return (
    <div className={`relative p-3 md:p-4 rounded-xl overflow-hidden group min-h-max transition-all hover:scale-105 ${themeConfig.name !== 'simple-light' ? glowClass : ''}`}>
      {/* Background with sleek effect */}
      <div className={`absolute inset-0 ${colorConfig.bg} border ${colorConfig.border} rounded-xl backdrop-blur-sm`} />
      {themeConfig.name !== 'simple-light' && (
        <div className={`absolute inset-0 bg-gradient-to-br ${colorConfig.glow} opacity-0 group-hover:opacity-20 rounded-xl transition-opacity duration-200`} />
      )}
      
      {/* Top accent line */}
      {themeConfig.name !== 'simple-light' && (
        <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${colorConfig.glow} opacity-80`} />
      )}
      
      {/* Content */}
      <div className="relative z-10 space-y-2">
        {/* Title - Compact label */}
        <div className={`text-xs font-bold uppercase tracking-wider ${colorConfig.accent} opacity-70 flex items-center gap-1 whitespace-nowrap`}>
          <span className="text-sm">{ICON_MAP[title] || '📈'}</span>
          <span className="hidden sm:inline">{title}</span>
        </div>
        
        {/* Main value - Compact and sleek */}
        <div className="flex items-end gap-0.5">
          <div className={`text-3xl md:text-5xl font-black ${colorConfig.accent} font-mono tracking-tight transition-all duration-200 group-hover:scale-105 cursor-pointer ${themeConfig.name === 'simple-light' ? '' : 'drop-shadow-md'}`} style={themeConfig.name !== 'simple-light' ? { textShadow: `0 0 12px ${colorConfig.accent.includes('green') ? 'rgba(34, 197, 94, 0.4)' : colorConfig.accent.includes('red') ? 'rgba(239, 68, 68, 0.4)' : colorConfig.accent.includes('blue') ? 'rgba(59, 130, 246, 0.4)' : colorConfig.accent.includes('purple') ? 'rgba(168, 85, 247, 0.4)' : 'rgba(249, 115, 22, 0.4)'}` } : {}}>
            <CountUpNumber value={value} />
          </div>
        </div>

        {subtitle && (
          <div className={`text-xs opacity-50 font-medium`}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
