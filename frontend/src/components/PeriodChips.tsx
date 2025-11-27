import { useTheme } from '../lib/themeContext';

export type Period = 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'lastMonth' | 'custom';

interface PeriodChipsProps {
  selected: Period;
  onSelect: (period: Period) => void;
  onCustomClick?: () => void;
}

export function PeriodChips({ selected, onSelect, onCustomClick }: PeriodChipsProps) {
  const { config } = useTheme();
  
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
    <div className="flex gap-1.5 overflow-x-auto pb-1 px-0 -mx-3 px-3">
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
          className={`px-3 md:px-3.5 py-1 md:py-1.5 rounded-full text-xs font-semibold whitespace-nowrap touch-manipulation transition-all ${
            selected === period.value
              ? `${config.chipActiveBg} ${config.chipActive} shadow-md scale-105`
              : `${config.chipInactive} hover:opacity-75`
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
