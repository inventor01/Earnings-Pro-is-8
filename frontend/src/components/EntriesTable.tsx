import { Entry } from '../lib/api';

interface EntriesTableProps {
  entries: Entry[];
  onDelete?: (id: number) => void;
  onEdit?: (entry: Entry) => void;
  onView?: (entry: Entry) => void;
  selectedIds?: number[];
  onSelectChange?: (ids: number[]) => void;
}

export function EntriesTable({ entries, onDelete, onEdit, onView, selectedIds = [], onSelectChange }: EntriesTableProps) {
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
    switch (app) {
      case 'DOORDASH':
        return 'border border-red-500 text-red-400 bg-red-950/30';
      case 'UBEREATS':
        return 'border border-green-500 text-green-400 bg-green-950/30';
      case 'INSTACART':
        return 'border border-orange-500 text-orange-400 bg-orange-950/30';
      case 'GRUBHUB':
        return 'border border-yellow-500 text-yellow-400 bg-yellow-950/30';
      default:
        return 'border border-gray-500 text-gray-400 bg-gray-950/30';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'GAS':
        return 'border border-blue-500 text-blue-400 bg-blue-950/30';
      case 'PARKING':
        return 'border border-purple-500 text-purple-400 bg-purple-950/30';
      case 'TOLLS':
        return 'border border-indigo-500 text-indigo-400 bg-indigo-950/30';
      case 'MAINTENANCE':
        return 'border border-cyan-500 text-cyan-400 bg-cyan-950/30';
      case 'PHONE':
        return 'border border-pink-500 text-pink-400 bg-pink-950/30';
      case 'SUBSCRIPTION':
        return 'border border-violet-500 text-violet-400 bg-violet-950/30';
      case 'FOOD':
        return 'border border-amber-500 text-amber-400 bg-amber-950/30';
      case 'LEISURE':
        return 'border border-rose-500 text-rose-400 bg-rose-950/30';
      default:
        return 'border border-gray-500 text-gray-400 bg-gray-950/30';
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (entries.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg shadow p-8 text-center text-cyan-400">
        No entries yet. Add your first entry using the calculator below!
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-900/60 border-b border-slate-700">
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
                  className="w-4 h-4 rounded border-cyan-500 text-cyan-400 focus:ring-cyan-400 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">App / Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Time</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Miles</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-cyan-400 uppercase">Note</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {entries.map((entry) => (
              <tr key={entry.id} className={`hover:bg-slate-700/30 transition-colors ${selectedIds.includes(entry.id) ? 'bg-cyan-500/10 border-l-2 border-cyan-400' : ''}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(entry.id)}
                    onChange={() => handleSelectOne(entry.id)}
                    className="w-4 h-4 rounded border-cyan-500 text-cyan-400 focus:ring-cyan-400 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xl mr-2">{getTypeIcon(entry.type)}</span>
                  <span className="text-sm text-cyan-300">{entry.type}</span>
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
                <td className="px-4 py-3 text-sm text-slate-400">
                  {formatDate(entry.timestamp)}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${
                  entry.amount >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  ${Math.abs(entry.amount).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-slate-400">
                  {entry.distance_miles > 0 ? `${entry.distance_miles.toFixed(1)} mi` : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">
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
                        className="text-cyan-400 hover:text-cyan-300 text-xs font-medium"
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
                    className="text-slate-400 hover:text-cyan-400 text-sm font-medium transition-colors"
                    title="View entry details"
                  >
                    👁️
                  </button>
                  <button
                    onClick={() => onEdit && onEdit(entry)}
                    className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete && onDelete(entry.id)}
                    className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
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
