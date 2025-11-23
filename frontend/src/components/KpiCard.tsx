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
    blue: 'border-blue-500 bg-blue-50',
    green: 'border-green-500 bg-green-50',
    red: 'border-red-500 bg-red-50',
    purple: 'border-purple-500 bg-purple-50',
    orange: 'border-orange-500 bg-orange-50',
    gray: 'border-gray-500 bg-gray-50',
  };

  const progressColor = goalProgress !== null && goalProgress !== undefined
    ? goalProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'
    : 'bg-gray-300';

  return (
    <div className={`border-l-4 ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue} p-4 rounded-lg shadow`}>
      <div className="text-sm text-gray-600 font-medium">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {trend && <div className="text-xs text-gray-500 mt-1">{trend}</div>}
      
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
