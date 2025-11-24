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
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg md:rounded-2xl shadow-xl p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <div className="text-4xl md:text-6xl font-black text-right mb-3 md:mb-6 p-3 md:p-6 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg md:rounded-xl border-4 border-blue-300">
          ${amount}
        </div>

        <div className="flex gap-2 md:gap-3 mb-4 md:mb-6">
          <button
            onClick={() => onModeChange('add')}
            className={`flex-1 py-3 md:py-4 rounded-lg md:rounded-xl font-bold text-base md:text-lg transition-all transform hover:scale-105 active:scale-95 ${
              mode === 'add'
                ? 'bg-gradient-to-r from-green-400 to-green-500 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ➕ Add
          </button>
          <button
            onClick={() => onModeChange('subtract')}
            className={`flex-1 py-3 md:py-4 rounded-lg md:rounded-xl font-bold text-base md:text-lg transition-all transform hover:scale-105 active:scale-95 ${
              mode === 'subtract'
                ? 'bg-gradient-to-r from-red-400 to-red-500 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ➖ Subtract
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((num) => (
          <button
            key={num}
            onClick={() => handleNumber(num)}
            className="bg-gradient-to-br from-gray-100 to-gray-200 hover:from-blue-200 hover:to-blue-300 p-4 md:p-6 rounded-lg md:rounded-xl text-lg md:text-2xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
          >
            {num}
          </button>
        ))}
        <button
          onClick={handleClear}
          className="bg-gradient-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white p-4 md:p-6 rounded-lg md:rounded-xl text-lg md:text-2xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
        >
          C
        </button>
        <button
          onClick={() => handleNumber('0')}
          className="bg-gradient-to-br from-gray-100 to-gray-200 hover:from-blue-200 hover:to-blue-300 p-4 md:p-6 rounded-lg md:rounded-xl text-lg md:text-2xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
        >
          0
        </button>
        <button
          onClick={handleDecimal}
          className="bg-gradient-to-br from-gray-100 to-gray-200 hover:from-blue-200 hover:to-blue-300 p-4 md:p-6 rounded-lg md:rounded-xl text-lg md:text-2xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
        >
          .
        </button>
        <button
          onClick={handleBackspace}
          className="col-span-3 bg-gradient-to-r from-gray-300 to-gray-400 hover:from-gray-400 hover:to-gray-500 p-4 md:p-6 rounded-lg md:rounded-xl text-base md:text-xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
        >
          ⌫ Backspace
        </button>
      </div>
    </div>
  );
}
