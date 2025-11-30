import { useTheme } from '../lib/themeContext';
import { CountUpNumber } from './CountUpNumber';

function getIconElement(title: string) {
  const iconPaths: Record<string, string> = {
    'Revenue': 'M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm0 20c-4.962 0-9-4.038-9-9s4.038-9 9-9 9 4.038 9 9-4.038 9-9 9zm3.5-9c.828 0 1.5-.672 1.5-1.5S16.328 9 15.5 9 14 9.672 14 10.5s.672 1.5 1.5 1.5zm-7 0c.828 0 1.5-.672 1.5-1.5S9.328 9 8.5 9 7 9.672 7 10.5 7.672 12 8.5 12zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z',
    'Expenses': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    'Profit': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    'Miles': 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm11 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM5 12l2-6h10l2 6H5z',
    '$/Mile': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z',
    '$/Hour': 'M11.99 5C6.47 5 2 8.13 2 12s4.47 7 9.99 7C17.52 19 22 15.87 22 12s-4.48-7-10.01-7zM12 17c-2.76 0-5-1.79-5-4s2.24-4 5-4 5 1.79 5 4-2.24 4-5 4zm.5-9H11V8h1.5V8zm0 6H11v-1.5h1.5V14z',
    'Avg Order': 'M3 13h2v8H3zm4-8h2v16H7zm4-2h2v18h-2zm4-2h2v20h-2zm4 4h2v16h-2z'
  };
  return iconPaths[title] || 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z';
}

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
    <div className={`relative p-5 md:p-7 lg:p-8 rounded-2xl overflow-hidden group min-h-max ${themeConfig.name !== 'simple-light' ? glowClass : ''}`}>
      {/* Background with dark dashboard effect */}
      <div className={`absolute inset-0 ${colorConfig.bg} border-2 ${colorConfig.border} rounded-2xl`} />
      {themeConfig.name !== 'simple-light' && (
        <div className={`absolute inset-0 bg-gradient-to-br ${colorConfig.glow} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />
      )}
      
      {/* Gauge arc effect */}
      {themeConfig.name !== 'simple-light' && (
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colorConfig.glow} rounded-full opacity-60`} />
      )}
      
      {/* Content */}
      <div className="relative z-10 space-y-3">
        {/* Title - Dashboard label */}
        <div className={`text-xs md:text-sm lg:text-base font-bold uppercase tracking-wide md:tracking-widest ${colorConfig.accent} opacity-80 font-mono flex items-center gap-1 whitespace-nowrap`}>
          <svg fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path d={getIconElement(title)}/></svg>
          {title}
        </div>
        
        {/* Main value - Large and prominent like speedometer */}
        <div className="flex items-end gap-1 min-w-0">
          <div className={`text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black ${colorConfig.accent} font-mono tracking-tight transition-all duration-300 group-hover:scale-110 cursor-pointer ${themeConfig.name === 'simple-light' ? '' : 'drop-shadow-lg group-hover:drop-shadow-2xl'} break-words`} style={themeConfig.name !== 'simple-light' ? { textShadow: `0 0 20px ${colorConfig.accent.includes('green') ? 'rgba(34, 197, 94, 0.5)' : colorConfig.accent.includes('red') ? 'rgba(239, 68, 68, 0.5)' : colorConfig.accent.includes('blue') ? 'rgba(59, 130, 246, 0.5)' : colorConfig.accent.includes('purple') ? 'rgba(168, 85, 247, 0.5)' : 'rgba(249, 115, 22, 0.5)'}` } : {}}>
            <CountUpNumber value={value} />
          </div>
        </div>

        {subtitle && (
          <div className={`text-xs md:text-sm opacity-60 font-medium`}>
            {subtitle}
          </div>
        )}

        {(detail1 || detail2) && (
          <div className="space-y-2 pt-2">
            {detail1 && (
              <div className="flex justify-between items-center text-xs md:text-sm">
                <span className={`${colorConfig.accent}`}>{detail1.label}</span>
                <span className={`font-semibold ${colorConfig.accent}`}>{detail1.value}</span>
              </div>
            )}
            {detail2 && (
              <div className="flex justify-between items-center text-xs md:text-sm">
                <span className={`${colorConfig.accent}`}>{detail2.label}</span>
                <span className={`font-semibold ${colorConfig.accent}`}>{detail2.value}</span>
              </div>
            )}
          </div>
        )}

        {trend && (
          <div className={`text-xs md:text-sm opacity-70 font-semibold font-mono`}>
            {trend}
          </div>
        )}
        
        {/* Bottom accent line */}
        {themeConfig.name !== 'simple-light' && (
          <div className={`h-0.5 bg-gradient-to-r ${colorConfig.glow} opacity-50 mt-3 rounded-full`} />
        )}
      </div>
    </div>
  );
}
