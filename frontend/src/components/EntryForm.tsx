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
            <label className="block text-base font-bold text-gray-800 mb-2">📝 Note (optional)</label>
            <textarea
              value={formData.note}
              onChange={(e) => onFormDataChange({ ...formData, note: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold"
              rows={3}
              placeholder="Add a note..."
            />
          </div>

          <div>
            <label className="block text-base font-bold text-gray-800 mb-3">📸 Receipt (optional)</label>
            <label className="flex flex-col items-center justify-center w-full px-4 py-6 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 border-2 border-dashed border-gradient-to-r border-purple-300 rounded-xl cursor-pointer hover:from-purple-100 hover:via-pink-100 hover:to-orange-100 transition-all duration-200 group shadow-sm hover:shadow-md">
              <div className="flex flex-col items-center justify-center">
                <svg className="w-10 h-10 text-purple-500 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-bold text-purple-700">Click to upload receipt</p>
                <p className="text-xs text-purple-500 mt-1">or drag and drop</p>
              </div>
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
                className="hidden"
              />
            </label>
            {formData.receipt_url && (
              <div className="mt-4">
                <div className="relative group">
                  <img 
                    src={formData.receipt_url} 
                    alt="Receipt preview" 
                    className="w-full h-48 object-cover rounded-xl border-2 border-purple-300 shadow-lg group-hover:shadow-xl transition-shadow"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-xl transition-all" />
                </div>
                <p className="text-xs text-green-600 mt-2 font-semibold">✓ Receipt uploaded</p>
              </div>
            )}
          </div>
        </>
      )}

      {!isExpense && (
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
      )}
    </div>
  );
}
