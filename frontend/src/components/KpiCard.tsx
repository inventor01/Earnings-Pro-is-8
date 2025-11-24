interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: string;
  color?: string;
  goalProgress?: number | null;
  goalTarget?: number | null;
}

export function KpiCard({ title, value, trend, color = 'blue', goalProgress, goalTarget }: KpiCardProps) {
  const colorConfig = {
    blue: { glow: 'from-blue-400 to-blue-600', accent: 'text-blue-400', border: 'border-blue-500', bg: 'bg-blue-900/20' },
    green: { glow: 'from-green-400 to-green-600', accent: 'text-green-400', border: 'border-green-500', bg: 'bg-green-900/20' },
    red: { glow: 'from-red-400 to-red-600', accent: 'text-red-400', border: 'border-red-500', bg: 'bg-red-900/20' },
    purple: { glow: 'from-purple-400 to-purple-600', accent: 'text-purple-400', border: 'border-purple-500', bg: 'bg-purple-900/20' },
    orange: { glow: 'from-orange-400 to-orange-600', accent: 'text-orange-400', border: 'border-orange-500', bg: 'bg-orange-900/20' },
    gray: { glow: 'from-gray-400 to-gray-600', accent: 'text-gray-400', border: 'border-gray-500', bg: 'bg-gray-900/20' },
  };

  const config = colorConfig[color as keyof typeof colorConfig] || colorConfig.blue;

  return (
    <div className={`relative p-4 md:p-6 rounded-2xl overflow-hidden group`}>
      {/* Background with dark dashboard effect */}
      <div className={`absolute inset-0 ${config.bg} backdrop-blur-sm border-2 ${config.border} rounded-2xl`} />
      <div className={`absolute inset-0 bg-gradient-to-br ${config.glow} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />
      
      {/* Gauge arc effect */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.glow} rounded-full opacity-60`} />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Title - Dashboard label */}
        <div className={`text-xs md:text-sm font-bold uppercase tracking-widest ${config.accent} opacity-80 mb-3 font-mono`}>
          {title}
        </div>
        
        {/* Main value - Large and prominent like speedometer */}
        <div className="flex items-end gap-1 mb-2">
          <div className={`text-3xl md:text-5xl font-black ${config.accent} font-mono tracking-tighter drop-shadow-2xl`} style={{textShadow: '0 0 8px currentColor'}}>
            {value}
          </div>
        </div>

        {trend && (
          <div className={`text-xs md:text-sm opacity-70 font-semibold font-mono`}>
            {trend}
          </div>
        )}
        
        {/* Bottom accent line */}
        <div className={`h-0.5 bg-gradient-to-r ${config.glow} opacity-50 mt-3 rounded-full`} />
      </div>
    </div>
  );
}
