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
  category: ExpenseCategory;
  note: string;
  receipt_url?: string;
}

export function EntryForm({ mode, onTypeChange, formData, onFormDataChange }: EntryFormProps) {
  const isExpense = formData.type === 'EXPENSE';
  const isOrder = formData.type === 'ORDER' || formData.type === 'CANCELLATION';

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg md:rounded-2xl shadow-lg p-4 md:p-6 space-y-3 md:space-y-4">
      <div>
        <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">📝 Type</label>
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
          className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
        >
          <option value="ORDER">Order</option>
          <option value="BONUS">Bonus</option>
          <option value="EXPENSE">Expense</option>
          <option value="CANCELLATION">Cancellation</option>
        </select>
      </div>

      {!isExpense && (
        <div>
          <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">🚗 App</label>
          <select
            value={formData.app}
            onChange={(e) => onFormDataChange({ ...formData, app: e.target.value as AppType })}
            className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
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
        <div>
          <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">🛣️ Distance (miles)</label>
          <input
            type="number"
            step="0.1"
            value={formData.distance_miles}
            onChange={(e) => onFormDataChange({ ...formData, distance_miles: e.target.value })}
            className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
            placeholder="5.5"
          />
        </div>
      )}

      {isExpense && (
        <>
          <div>
            <label className="block text-sm md:text-base font-bold text-gray-800 mb-1 md:mb-2">🏷️ Category</label>
            <select
              value={formData.category}
              onChange={(e) => onFormDataChange({ ...formData, category: e.target.value as ExpenseCategory })}
              className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base font-semibold"
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
            <label className="block text-base font-bold text-gray-800 mb-2">📸 Receipt (optional)</label>
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
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            />
            {formData.receipt_url && (
              <div className="mt-3">
                <img 
                  src={formData.receipt_url} 
                  alt="Receipt preview" 
                  className="w-full h-48 object-cover rounded-xl border-2 border-gray-200"
                />
              </div>
            )}
          </div>
        </>
      )}

      <div>
        <label className="block text-base font-bold text-gray-800 mb-2">📝 Note (optional)</label>
        <textarea
          value={formData.note}
          onChange={(e) => onFormDataChange({ ...formData, note: e.target.value })}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold"
          rows={3}
          placeholder="Add a note..."
        />
      </div>
    </div>
  );
}
