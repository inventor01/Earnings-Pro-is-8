import { useTheme } from '../lib/themeContext';

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

export function KpiCard({ title, value, subtitle, detail1, detail2, trend, color = 'blue', goalProgress, goalTarget }: KpiCardProps) {
  const { config: themeConfig } = useTheme();
  const colorConfig = themeConfig.kpiColors[color];

  return (
    <div className={`relative p-4 md:p-6 rounded-2xl overflow-hidden group min-h-max`}>
      {/* Background with dark dashboard effect */}
      <div className={`absolute inset-0 ${colorConfig.bg} backdrop-blur-sm border-2 ${colorConfig.border} rounded-2xl`} />
      <div className={`absolute inset-0 bg-gradient-to-br ${colorConfig.glow} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />
      
      {/* Gauge arc effect */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colorConfig.glow} rounded-full opacity-60`} />
      
      {/* Content */}
      <div className="relative z-10 space-y-3">
        {/* Title - Dashboard label */}
        <div className={`text-xs md:text-sm font-bold uppercase tracking-widest ${colorConfig.accent} opacity-80 font-mono`}>
          {title}
        </div>
        
        {/* Main value - Large and prominent like speedometer */}
        <div className="flex items-end gap-1">
          <div className={`text-3xl md:text-4xl font-black ${colorConfig.accent} font-mono tracking-tight drop-shadow-lg`}>
            {value}
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
        <div className={`h-0.5 bg-gradient-to-r ${colorConfig.glow} opacity-50 mt-3 rounded-full`} />
      </div>
    </div>
  );
}
