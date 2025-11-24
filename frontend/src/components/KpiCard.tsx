interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: string;
  color?: string;
  goalProgress?: number | null;
  goalTarget?: number | null;
}

export function KpiCard({ title, value, trend, color = 'blue', goalProgress, goalTarget }: KpiCardProps) {
  const colorClasses = {
    blue: 'border-l-8 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100',
    green: 'border-l-8 border-green-500 bg-gradient-to-br from-green-50 to-green-100',
    red: 'border-l-8 border-red-500 bg-gradient-to-br from-red-50 to-red-100',
    purple: 'border-l-8 border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100',
    orange: 'border-l-8 border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100',
    gray: 'border-l-8 border-gray-500 bg-gradient-to-br from-gray-50 to-gray-100',
  };

  const progressColor = goalProgress !== null && goalProgress !== undefined
    ? goalProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'
    : 'bg-gray-300';

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue} p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow`}>
      <div className="text-base text-gray-700 font-bold uppercase tracking-wide">{title}</div>
      <div className="text-4xl font-black mt-3 text-gray-900">{value}</div>
      {trend && <div className="text-sm text-gray-600 mt-2 font-semibold">{trend}</div>}
      
      {goalProgress !== null && goalProgress !== undefined && goalTarget && (
        <div className="mt-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500">Goal: ${typeof goalTarget === 'string' ? goalTarget : goalTarget.toFixed(2)}</span>
            <span className="text-xs font-medium text-gray-600">{Math.round(goalProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`${progressColor} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(goalProgress, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
