export type Period = 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'lastMonth' | 'custom';

interface PeriodChipsProps {
  selected: Period;
  onSelect: (period: Period) => void;
  onCustomClick?: () => void;
}

export function PeriodChips({ selected, onSelect, onCustomClick }: PeriodChipsProps) {
  const periods: { value: Period; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'This Week' },
    { value: 'last7', label: 'Last 7 Days' },
    { value: 'month', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => {
            if (period.value === 'custom' && onCustomClick) {
              onCustomClick();
            } else {
              onSelect(period.value);
            }
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
            selected === period.value
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
