import { useState } from 'react';

export type CalcMode = 'add' | 'subtract';

interface CalcPadProps {
  amount: string;
  mode: CalcMode;
  onAmountChange: (amount: string) => void;
  onModeChange: (mode: CalcMode) => void;
}

export function CalcPad({ amount, mode, onAmountChange, onModeChange }: CalcPadProps) {
  const handleNumber = (num: string) => {
    if (amount === '0') {
      onAmountChange(num);
    } else {
      onAmountChange(amount + num);
    }
  };

  const handleDecimal = () => {
    if (!amount.includes('.')) {
      onAmountChange(amount + '.');
    }
  };

  const handleBackspace = () => {
    if (amount.length > 1) {
      onAmountChange(amount.slice(0, -1));
    } else {
      onAmountChange('0');
    }
  };

  const handleClear = () => {
    onAmountChange('0');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="mb-4">
        <div className="text-4xl font-bold text-right mb-4 p-4 bg-gray-100 rounded-lg">
          ${amount}
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => onModeChange('add')}
            className={`flex-1 py-3 rounded-lg font-medium ${
              mode === 'add'
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            ➕ Add
          </button>
          <button
            onClick={() => onModeChange('subtract')}
            className={`flex-1 py-3 rounded-lg font-medium ${
              mode === 'subtract'
                ? 'bg-red-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            ➖ Subtract
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((num) => (
          <button
            key={num}
            onClick={() => handleNumber(num)}
            className="bg-gray-200 hover:bg-gray-300 p-4 rounded-lg text-xl font-semibold"
          >
            {num}
          </button>
        ))}
        <button
          onClick={handleClear}
          className="bg-orange-500 hover:bg-orange-600 text-white p-4 rounded-lg text-xl font-semibold"
        >
          C
        </button>
        <button
          onClick={() => handleNumber('0')}
          className="bg-gray-200 hover:bg-gray-300 p-4 rounded-lg text-xl font-semibold"
        >
          0
        </button>
        <button
          onClick={handleDecimal}
          className="bg-gray-200 hover:bg-gray-300 p-4 rounded-lg text-xl font-semibold"
        >
          .
        </button>
        <button
          onClick={handleBackspace}
          className="col-span-3 bg-gray-300 hover:bg-gray-400 p-4 rounded-lg text-lg font-semibold"
        >
          ⌫ Backspace
        </button>
      </div>
    </div>
  );
}
