import { Entry } from '../lib/api';
import { useTheme } from '../lib/themeContext';
import { formatDateEST } from '../lib/dateUtils';

interface EntriesTableProps {
  entries: Entry[];
  onDelete?: (id: number) => void;
  onEdit?: (entry: Entry) => void;
  onView?: (entry: Entry) => void;
  selectedIds?: number[];
  onSelectChange?: (ids: number[]) => void;
}

export function EntriesTable({ entries, onDelete, onEdit, onView, selectedIds = [], onSelectChange }: EntriesTableProps) {
  const { config } = useTheme();
  const allSelected = entries.length > 0 && selectedIds.length === entries.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < entries.length;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectChange?.([]);
    } else {
      onSelectChange?.(entries.map(e => e.id));
    }
  };

  const handleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      onSelectChange?.(selectedIds.filter(i => i !== id));
    } else {
      onSelectChange?.([...selectedIds, id]);
    }
  };
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ORDER':
        return '📦';
      case 'BONUS':
        return '🎁';
      case 'EXPENSE':
        return '💰';
      case 'CANCELLATION':
        return '❌';
      default:
        return '•';
    }
  };

  const getAppColor = (app: string) => {
    const isBWTheme = config.name === 'bw-neon';
    if (isBWTheme) {
      return 'border border-white text-white bg-black';
    }
    switch (app) {
      case 'DOORDASH':
        return 'border border-red-500 text-white bg-red-500';
      case 'UBEREATS':
        return 'border border-green-500 text-white bg-green-500';
      case 'INSTACART':
        return 'border border-orange-500 text-white bg-orange-500';
      case 'GRUBHUB':
        return 'border border-yellow-500 text-white bg-yellow-500';
      case 'SHIPT':
        return 'border border-blue-500 text-white bg-blue-500';
      default:
        return 'border border-gray-500 text-white bg-gray-500';
    }
  };

  const getCategoryColor = (category: string) => {
    const isBWTheme = config.name === 'bw-neon';
    if (isBWTheme) {
      return 'border border-white text-white bg-black';
    }
    switch (category) {
      case 'GAS':
        return 'border border-blue-500 text-white bg-blue-500';
      case 'PARKING':
        return 'border border-purple-500 text-white bg-purple-500';
      case 'TOLLS':
        return 'border border-indigo-500 text-white bg-indigo-500';
      case 'MAINTENANCE':
        return 'border border-cyan-500 text-white bg-cyan-500';
      case 'PHONE':
        return 'border border-pink-500 text-white bg-pink-500';
      case 'SUBSCRIPTION':
        return 'border border-violet-500 text-white bg-violet-500';
      case 'FOOD':
        return 'border border-amber-500 text-white bg-amber-500';
      case 'LEISURE':
        return 'border border-rose-500 text-white bg-rose-500';
      default:
        return 'border border-gray-500 text-white bg-gray-500';
    }
  };

  const getCategoryEmoji = (category: string) => {
    switch (category) {
      case 'GAS':
        return '⛽';
      case 'PARKING':
        return '🅿️';
      case 'TOLLS':
        return '🛣️';
      case 'MAINTENANCE':
        return '🔧';
      case 'PHONE':
        return '📱';
      case 'SUBSCRIPTION':
        return '📦';
      case 'FOOD':
        return '🍔';
      case 'LEISURE':
        return '🎮';
      default:
        return '📋';
    }
  };


  if (entries.length === 0) {
    const isDarkTheme = config.name !== 'simple-light';
    return (
      <div className={`rounded-lg shadow p-8 text-center ${config.tableBg} ${isDarkTheme ? 'text-cyan-400' : 'text-blue-600'}`}>
        No entries yet. Add your first entry using the calculator below!
      </div>
    );
  }

  return (
    <div className={`rounded-lg shadow overflow-hidden ${config.tableBg}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={config.tableHeader}>
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={input => {
                    if (input) {
                      input.indeterminate = someSelected;
                    }
                  }}
                  onChange={handleSelectAll}
                  className={`w-4 h-4 rounded cursor-pointer ${config.name === 'bw-neon' ? 'border-white text-white' : config.name === 'simple-light' ? 'border-blue-500 text-blue-600' : 'border-cyan-500 text-cyan-400'}`}
                />
              </th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${config.tableHeaderText}`}>Type</th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${config.tableHeaderText}`}>App / Category</th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${config.tableHeaderText}`}>Time</th>
              <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${config.tableHeaderText}`}>Amount</th>
              <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${config.tableHeaderText}`}>Miles</th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${config.tableHeaderText}`}>Note</th>
              <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${config.tableHeaderText}`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${config.name === 'simple-light' ? 'divide-gray-200' : 'divide-slate-700'}`}>
            {entries.map((entry) => (
              <tr key={entry.id} className={`${config.tableRowHover} transition-colors ${selectedIds.includes(entry.id) ? config.tableRowSelected : ''}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(entry.id)}
                    onChange={() => handleSelectOne(entry.id)}
                    className={`w-4 h-4 rounded cursor-pointer ${config.name === 'bw-neon' ? 'border-white text-white' : config.name === 'simple-light' ? 'border-blue-500 text-blue-600' : 'border-cyan-500 text-cyan-400'}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xl mr-2">{getTypeIcon(entry.type)}</span>
                  <span className={`text-sm ${config.textPrimary}`}>{entry.type}</span>
                </td>
                <td className="px-4 py-3">
                  {entry.type === 'EXPENSE' ? (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(entry.category || 'OTHER')}`}>
                      {getCategoryEmoji(entry.category || 'OTHER')} {entry.category || 'OTHER'}
                    </span>
                  ) : (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAppColor(entry.app)}`}>
                      {entry.app}
                    </span>
                  )}
                </td>
                <td className={`px-4 py-3 text-sm ${config.textSecondary}`}>
                  {formatDateEST(entry.timestamp)}
                </td>
                <td className={`px-4 py-3 text-right font-black ${
                  entry.amount >= 0 ? config.textGreen : config.textRed
                }`}>
                  ${Math.abs(entry.amount).toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-right text-sm ${config.textSecondary}`}>
                  {entry.distance_miles > 0 ? `${entry.distance_miles.toFixed(1)} mi` : '-'}
                </td>
                <td className={`px-4 py-3 text-sm ${config.textSecondary}`}>
                  <div className="flex flex-col gap-1">
                    {entry.note && <span className="truncate max-w-xs">{entry.note}</span>}
                    {entry.receipt_url && (
                      <button
                        onClick={() => {
                          const img = new Image();
                          img.src = entry.receipt_url!;
                          const link = document.createElement('a');
                          link.href = entry.receipt_url!;
                          link.target = '_blank';
                          link.click();
                        }}
                        className={`text-xs font-medium ${config.textCyan} hover:opacity-80 transition-opacity`}
                        title="View receipt"
                      >
                        📸 Receipt
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right space-x-2 flex justify-end">
                  <button
                    onClick={() => onView && onView(entry)}
                    className={`text-sm font-medium transition-colors ${config.textSecondary} hover:${config.textCyan}`}
                    title="View entry details"
                  >
                    👁️
                  </button>
                  <button
                    onClick={() => onEdit && onEdit(entry)}
                    className={`text-sm font-medium transition-colors ${config.textCyan} hover:opacity-80`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete && onDelete(entry.id)}
                    className={`text-sm font-medium transition-colors ${config.textRed} hover:opacity-80`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
