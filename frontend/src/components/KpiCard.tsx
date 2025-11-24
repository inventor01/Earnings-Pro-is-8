import { useTheme } from '../lib/themeContext';

interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: string;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'gray';
  goalProgress?: number | null;
  goalTarget?: number | null;
}

export function KpiCard({ title, value, trend, color = 'blue', goalProgress, goalTarget }: KpiCardProps) {
  const { config: themeConfig } = useTheme();
  const colorConfig = themeConfig.kpiColors[color];

  return (
    <div className={`relative p-4 md:p-6 rounded-2xl overflow-hidden group`}>
      {/* Background with dark dashboard effect */}
      <div className={`absolute inset-0 ${colorConfig.bg} backdrop-blur-sm border-2 ${colorConfig.border} rounded-2xl`} />
      <div className={`absolute inset-0 bg-gradient-to-br ${colorConfig.glow} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />
      
      {/* Gauge arc effect */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colorConfig.glow} rounded-full opacity-60`} />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Title - Dashboard label */}
        <div className={`text-xs md:text-sm font-bold uppercase tracking-widest ${colorConfig.accent} opacity-80 mb-3 font-mono`}>
          {title}
        </div>
        
        {/* Main value - Large and prominent like speedometer */}
        <div className="flex items-end gap-1 mb-2">
          <div className={`text-3xl md:text-5xl font-black ${colorConfig.accent} font-mono tracking-tight drop-shadow-lg`}>
            {value}
          </div>
        </div>

        {trend && (
          <div className={`text-xs md:text-sm opacity-70 font-semibold font-mono`}>
            {trend}
          </div>
        )}
        
        {/* Bottom accent line */}
        <div className={`h-0.5 bg-gradient-to-r ${colorConfig.glow} opacity-50 mt-3 rounded-full`} />
      </div>
    </div>
  );
}
