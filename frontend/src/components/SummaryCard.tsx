import { useTheme } from '../lib/themeContext';

interface SummaryCardProps {
  revenue: string;
  expenses: string;
  profit: string;
  miles: string;
  orders: number;
  margin: string;
}

export function SummaryCard({ revenue, expenses, profit, miles, orders, margin }: SummaryCardProps) {
  const { config: themeConfig } = useTheme();
  const colorConfig = themeConfig.kpiColors['blue'];

  return (
    <div className="w-full relative p-6 md:p-8 rounded-2xl overflow-hidden group mb-6">
      {/* Background with dark dashboard effect */}
      <div className={`absolute inset-0 ${colorConfig.bg} backdrop-blur-sm border-2 ${colorConfig.border} rounded-2xl`} />
      <div className={`absolute inset-0 bg-gradient-to-br ${colorConfig.glow} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />
      
      {/* Gauge arc effect */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colorConfig.glow} rounded-full opacity-60`} />
      
      {/* Content */}
      <div className="relative z-10">
        <div className={`text-sm font-bold uppercase tracking-widest ${colorConfig.accent} opacity-80 font-mono mb-6`}>
          Performance Overview
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
          {/* Revenue */}
          <div className="space-y-1">
            <div className={`text-sm font-bold uppercase tracking-wider ${colorConfig.accent}`} style={{ fontFamily: "'Poppins', sans-serif" }}>Revenue</div>
            <div className={`text-2xl md:text-3xl font-black ${colorConfig.accent} font-mono`}>
              {revenue}
            </div>
          </div>

          {/* Expenses */}
          <div className="space-y-1">
            <div className={`text-sm font-bold uppercase tracking-wider ${themeConfig.kpiColors['red'].accent}`} style={{ fontFamily: "'Poppins', sans-serif" }}>Expenses</div>
            <div className={`text-2xl md:text-3xl font-black ${themeConfig.kpiColors['red'].accent} font-mono`}>
              {expenses}
            </div>
          </div>

          {/* Profit */}
          <div className="space-y-1">
            <div className={`text-sm font-bold uppercase tracking-wider ${themeConfig.kpiColors['green'].accent}`} style={{ fontFamily: "'Poppins', sans-serif" }}>Profit</div>
            <div className={`text-2xl md:text-3xl font-black ${themeConfig.kpiColors['green'].accent} font-mono`}>
              {profit}
            </div>
            <div className="text-xs text-white">Margin: {margin}</div>
          </div>

          {/* Miles */}
          <div className="space-y-1">
            <div className={`text-sm font-bold uppercase tracking-wider ${themeConfig.kpiColors['purple'].accent}`} style={{ fontFamily: "'Poppins', sans-serif" }}>Miles</div>
            <div className={`text-2xl md:text-3xl font-black ${themeConfig.kpiColors['purple'].accent} font-mono`}>
              {miles}
            </div>
          </div>

          {/* Orders */}
          <div className="space-y-1">
            <div className={`text-sm font-bold uppercase tracking-wider ${themeConfig.kpiColors['green'].accent}`} style={{ fontFamily: "'Poppins', sans-serif" }}>Orders</div>
            <div className={`text-2xl md:text-3xl font-black ${themeConfig.kpiColors['green'].accent} font-mono`}>
              {orders}
            </div>
          </div>
        </div>
        
        {/* Bottom accent line */}
        <div className={`h-0.5 bg-gradient-to-r ${colorConfig.glow} opacity-50 mt-6 rounded-full`} />
      </div>
    </div>
  );
}
