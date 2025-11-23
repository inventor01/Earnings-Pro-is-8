interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: string;
  color?: string;
}

export function KpiCard({ title, value, trend, color = 'blue' }: KpiCardProps) {
  const colorClasses = {
    blue: 'border-blue-500 bg-blue-50',
    green: 'border-green-500 bg-green-50',
    red: 'border-red-500 bg-red-50',
    purple: 'border-purple-500 bg-purple-50',
    orange: 'border-orange-500 bg-orange-50',
    gray: 'border-gray-500 bg-gray-50',
  };

  return (
    <div className={`border-l-4 ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue} p-4 rounded-lg shadow`}>
      <div className="text-sm text-gray-600 font-medium">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {trend && <div className="text-xs text-gray-500 mt-1">{trend}</div>}
    </div>
  );
}
