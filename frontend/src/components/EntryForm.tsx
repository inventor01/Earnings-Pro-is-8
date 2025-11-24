import { AppType, EntryType, ExpenseCategory } from '../lib/api';
import { CalcMode } from './CalcPad';

interface EntryFormProps {
  mode: CalcMode;
  onTypeChange: (type: EntryType) => void;
  formData: EntryFormData;
  onFormDataChange: (data: EntryFormData) => void;
}

export interface EntryFormData {
  type: EntryType;
  app: AppType;
  distance_miles: string;
  duration_minutes: string;
  category: ExpenseCategory;
  note: string;
  receipt_url?: string;
}

export function EntryForm({ mode, onTypeChange, formData, onFormDataChange }: EntryFormProps) {
  const isExpense = formData.type === 'EXPENSE';
  const isOrder = formData.type === 'ORDER' || formData.type === 'CANCELLATION';

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={formData.type}
          onChange={(e) => {
            const newType = e.target.value as EntryType;
            const updatedData = { ...formData, type: newType };
            // Set app to 'OTHER' when switching to EXPENSE (since app field is hidden for expenses)
            if (newType === 'EXPENSE') {
              updatedData.app = 'OTHER';
            }
            onFormDataChange(updatedData);
            onTypeChange(newType);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ORDER">Order</option>
          <option value="BONUS">Bonus</option>
          <option value="EXPENSE">Expense</option>
          <option value="CANCELLATION">Cancellation</option>
        </select>
      </div>

      {!isExpense && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">App</label>
          <select
            value={formData.app}
            onChange={(e) => onFormDataChange({ ...formData, app: e.target.value as AppType })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="UBEREATS">UberEats</option>
            <option value="DOORDASH">DoorDash</option>
            <option value="INSTACART">Instacart</option>
            <option value="GRUBHUB">GrubHub</option>
            <option value="SHIPT">Shipt</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      )}

      {isOrder && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Distance (miles)</label>
            <input
              type="number"
              step="0.1"
              value={formData.distance_miles}
              onChange={(e) => onFormDataChange({ ...formData, distance_miles: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="5.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration_minutes}
              onChange={(e) => onFormDataChange({ ...formData, duration_minutes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="30"
            />
          </div>
        </>
      )}

      {isExpense && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => onFormDataChange({ ...formData, category: e.target.value as ExpenseCategory })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="GAS">⛽ Gas</option>
              <option value="PARKING">🅿️ Parking</option>
              <option value="TOLLS">🛣️ Tolls</option>
              <option value="MAINTENANCE">🔧 Maintenance</option>
              <option value="PHONE">📱 Phone</option>
              <option value="SUBSCRIPTION">📦 Subscription</option>
              <option value="FOOD">🍔 Food</option>
              <option value="LEISURE">🎮 Leisure</option>
              <option value="OTHER">📋 Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receipt (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    onFormDataChange({ ...formData, receipt_url: base64 });
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {formData.receipt_url && (
              <div className="mt-2">
                <img 
                  src={formData.receipt_url} 
                  alt="Receipt preview" 
                  className="w-full h-40 object-cover rounded-lg border border-gray-200"
                />
              </div>
            )}
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
        <textarea
          value={formData.note}
          onChange={(e) => onFormDataChange({ ...formData, note: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          placeholder="Add a note..."
        />
      </div>
    </div>
  );
}
