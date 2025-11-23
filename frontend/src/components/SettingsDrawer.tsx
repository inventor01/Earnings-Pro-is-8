import { useState } from 'react';
import { Settings } from '../lib/api';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export function SettingsDrawer({ isOpen, onClose, settings, onSave }: SettingsDrawerProps) {
  const [costPerMile, setCostPerMile] = useState(settings.cost_per_mile.toString());

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ cost_per_mile: parseFloat(costPerMile) });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cost Per Mile ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={costPerMile}
            onChange={(e) => setCostPerMile(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            This is used to calculate profit from mileage
          </p>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600"
        >
          Save Settings
        </button>
      </div>
    </>
  );
}
