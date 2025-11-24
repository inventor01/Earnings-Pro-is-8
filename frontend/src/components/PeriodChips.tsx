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
    <div className="flex gap-1 md:gap-2 overflow-x-auto pb-2 px-1">
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
          className={`px-2 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap touch-manipulation transition-all ${
            selected === period.value
              ? `${config.chipActiveBg} ${config.chipActive} shadow-lg`
              : config.chipInactive
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
