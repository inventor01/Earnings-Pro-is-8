import { useState, useEffect } from 'react';
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
  order_id: string;
  distance_miles: string;
  duration_minutes: string;
  category: ExpenseCategory;
  note: string;
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
            onFormDataChange({ ...formData, type: newType });
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

      {isOrder && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order ID (optional)</label>
          <input
            type="text"
            value={formData.order_id}
            onChange={(e) => onFormDataChange({ ...formData, order_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ORD-12345"
          />
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={formData.category}
            onChange={(e) => onFormDataChange({ ...formData, category: e.target.value as ExpenseCategory })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="GAS">Gas</option>
            <option value="PARKING">Parking</option>
            <option value="TOLLS">Tolls</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="PHONE">Phone</option>
            <option value="SUBSCRIPTION">Subscription</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
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
