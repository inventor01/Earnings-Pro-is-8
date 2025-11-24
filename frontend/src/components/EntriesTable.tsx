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
        return 'bg-red-100 text-red-800';
      case 'UBEREATS':
        return 'bg-green-100 text-green-800';
      case 'INSTACART':
        return 'bg-orange-100 text-orange-800';
      case 'GRUBHUB':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'GAS':
        return 'bg-blue-100 text-blue-800';
      case 'PARKING':
        return 'bg-purple-100 text-purple-800';
      case 'TOLLS':
        return 'bg-indigo-100 text-indigo-800';
      case 'MAINTENANCE':
        return 'bg-cyan-100 text-cyan-800';
      case 'PHONE':
        return 'bg-pink-100 text-pink-800';
      case 'SUBSCRIPTION':
        return 'bg-violet-100 text-violet-800';
      case 'FOOD':
        return 'bg-amber-100 text-amber-800';
      case 'LEISURE':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        No entries yet. Add your first entry using the calculator below!
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
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
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">App / Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Miles</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry) => (
              <tr key={entry.id} className={`hover:bg-gray-50 ${selectedIds.includes(entry.id) ? 'bg-blue-50' : ''}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(entry.id)}
                    onChange={() => handleSelectOne(entry.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xl mr-2">{getTypeIcon(entry.type)}</span>
                  <span className="text-sm">{entry.type}</span>
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
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatDate(entry.timestamp)}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${
                  entry.amount >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${Math.abs(entry.amount).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  {entry.distance_miles > 0 ? `${entry.distance_miles.toFixed(1)} mi` : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
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
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
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
                    className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                    title="View entry details"
                  >
                    👁️
                  </button>
                  <button
                    onClick={() => onEdit && onEdit(entry)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete && onDelete(entry.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
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
