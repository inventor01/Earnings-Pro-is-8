import { Entry } from '../lib/api';
import { formatDateEST } from '../lib/dateUtils';

interface EntryViewerProps {
  entry: Entry;
  onClose: () => void;
}

export function EntryViewer({ entry, onClose }: EntryViewerProps) {
  const getTypeEmoji = (type: string) => {
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


  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-w-md w-full md:w-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 md:p-6 flex items-center justify-between rounded-t-2xl md:rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl md:text-4xl">{getTypeEmoji(entry.type)}</span>
            <div>
              <h2 className="text-lg md:text-xl font-bold">{entry.type}</h2>
              <p className="text-xs md:text-sm opacity-90">{formatDateEST(entry.timestamp)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-2xl hover:opacity-80 transition"
          >
            ✕
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Amount */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 md:p-5">
              <p className="text-xs md:text-sm font-medium text-gray-600 mb-1">Amount</p>
              <p className={`text-2xl md:text-3xl font-bold ${entry.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(entry.amount).toFixed(2)}
              </p>
            </div>

            {/* App / Category */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 md:p-5">
              <p className="text-xs md:text-sm font-medium text-gray-600 mb-1">
                {entry.type === 'EXPENSE' ? 'Category' : 'App'}
              </p>
              <p className="text-lg md:text-xl font-semibold text-purple-900">
                {entry.type === 'EXPENSE' ? (
                  <>
                    <span className="mr-2">{getCategoryEmoji(entry.category || 'OTHER')}</span>
                    {entry.category || 'OTHER'}
                  </>
                ) : (
                  entry.app
                )}
              </p>
            </div>

            {/* Distance */}
            {entry.distance_miles > 0 && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 md:p-5">
                <p className="text-xs md:text-sm font-medium text-gray-600 mb-1">Distance</p>
                <p className="text-2xl md:text-3xl font-bold text-orange-600">
                  {entry.distance_miles.toFixed(1)} mi
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          {entry.note && (
            <div className="bg-gray-50 rounded-lg p-4 md:p-5 border border-gray-200">
              <p className="text-xs md:text-sm font-medium text-gray-600 mb-2">Notes</p>
              <p className="text-sm md:text-base text-gray-800">{entry.note}</p>
            </div>
          )}

          {/* Receipt */}
          {entry.receipt_url && (
            <div className="bg-gray-50 rounded-lg p-4 md:p-5 border border-gray-200">
              <p className="text-xs md:text-sm font-medium text-gray-600 mb-3">Receipt</p>
              <div className="rounded-lg overflow-hidden border border-gray-300">
                <img
                  src={entry.receipt_url}
                  alt="Receipt"
                  className="w-full h-auto max-h-96 object-contain bg-white"
                />
              </div>
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = entry.receipt_url!;
                  link.target = '_blank';
                  link.click();
                }}
                className="mt-3 w-full text-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
              >
                Open in New Tab
              </button>
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs md:text-sm text-gray-500 text-center bg-gray-50 rounded-lg p-3 md:p-4">
            Created: {formatDateEST(entry.created_at)}
          </div>
        </div>

        <div className="p-4 md:p-6 bg-gray-50 border-t flex gap-3 rounded-b-2xl md:rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 md:py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium text-sm md:text-base"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
