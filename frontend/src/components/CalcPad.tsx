import { useRef, useState } from 'react';

export type CalcMode = 'add' | 'subtract';

interface CalcPadProps {
  amount: string;
  mode: CalcMode;
  onAmountChange: (amount: string) => void;
  onModeChange: (mode: CalcMode) => void;
  onNextStep?: () => void;
}

export function CalcPad({ amount, mode, onAmountChange, onModeChange, onNextStep }: CalcPadProps) {
  const [isCHeld, setIsCHeld] = useState(false);
  const cTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleClearFull = () => {
    onAmountChange('0');
  };

  const handleCTouchStart = () => {
    setIsCHeld(false);
    cTimeoutRef.current = setTimeout(() => {
      setIsCHeld(true);
      handleClearFull();
    }, 500);
  };

  const handleCTouchEnd = () => {
    if (cTimeoutRef.current) {
      clearTimeout(cTimeoutRef.current);
      cTimeoutRef.current = null;
    }
    if (!isCHeld) {
      handleBackspace();
    }
    setIsCHeld(false);
  };


  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg md:rounded-2xl shadow-xl p-4 md:p-6 w-full">
      <div className="mb-4 md:mb-6">
        <div className="text-4xl md:text-6xl font-black text-right mb-3 md:mb-6 p-3 md:p-6 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg md:rounded-xl border-4 border-blue-300 w-full box-border">
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
            ➕ Revenue
          </button>
          <button
            onClick={() => onModeChange('subtract')}
            className={`flex-1 py-3 md:py-4 rounded-lg md:rounded-xl font-bold text-base md:text-lg transition-all transform hover:scale-105 active:scale-95 ${
              mode === 'subtract'
                ? 'bg-gradient-to-r from-red-400 to-red-500 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ➖ Expense
          </button>
        </div>
      </div>

      <div className="space-y-2 md:space-y-3">
        {/* Row 1: 7 8 9 */}
        <div className="grid grid-cols-3 gap-2 md:gap-3 w-full">
          {['7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumber(num)}
              className="w-full bg-gradient-to-br from-gray-100 to-gray-200 hover:from-blue-200 hover:to-blue-300 p-4 md:p-6 rounded-lg md:rounded-xl text-lg md:text-2xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
            >
              {num}
            </button>
          ))}
        </div>

        {/* Row 2: 4 5 6 */}
        <div className="grid grid-cols-3 gap-2 md:gap-3 w-full">
          {['4', '5', '6'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumber(num)}
              className="w-full bg-gradient-to-br from-gray-100 to-gray-200 hover:from-blue-200 hover:to-blue-300 p-4 md:p-6 rounded-lg md:rounded-xl text-lg md:text-2xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
            >
              {num}
            </button>
          ))}
        </div>

        {/* Row 3: 1 2 3 */}
        <div className="grid grid-cols-3 gap-2 md:gap-3 w-full">
          {['1', '2', '3'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumber(num)}
              className="w-full bg-gradient-to-br from-gray-100 to-gray-200 hover:from-blue-200 hover:to-blue-300 p-4 md:p-6 rounded-lg md:rounded-xl text-lg md:text-2xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
            >
              {num}
            </button>
          ))}
        </div>

        {/* Row 4: C 0 . */}
        <div className="grid grid-cols-3 gap-2 md:gap-3 w-full">
          <button
            onTouchStart={handleCTouchStart}
            onTouchEnd={handleCTouchEnd}
            onMouseDown={handleCTouchStart}
            onMouseUp={handleCTouchEnd}
            className={`w-full p-4 md:p-6 rounded-lg md:rounded-xl text-lg md:text-2xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation ${
              isCHeld
                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white scale-110'
                : 'bg-gradient-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white'
            }`}
            title="Tap to backspace, hold to clear"
          >
            {isCHeld ? '✓' : '⌫'}
          </button>
          <button
            onClick={() => handleNumber('0')}
            className="w-full bg-gradient-to-br from-gray-100 to-gray-200 hover:from-blue-200 hover:to-blue-300 p-4 md:p-6 rounded-lg md:rounded-xl text-lg md:text-2xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
          >
            0
          </button>
          <button
            onClick={handleDecimal}
            className="w-full bg-gradient-to-br from-gray-100 to-gray-200 hover:from-blue-200 hover:to-blue-300 p-4 md:p-6 rounded-lg md:rounded-xl text-lg md:text-2xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
          >
            .
          </button>
        </div>

        {/* Row 5: Next Step */}
        <button
          onClick={() => onNextStep?.()}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 py-4 rounded-lg text-lg font-bold transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
        >
          Next Step →
        </button>
      </div>
    </div>
  );
}
