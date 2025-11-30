import { useState, useEffect, useRef } from 'react';

interface DistanceCalcProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function DistanceCalc({ value, onValueChange }: DistanceCalcProps) {
  const [display, setDisplay] = useState(value || '0');
  const [isCHeld, setIsCHeld] = useState(false);
  const cTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setDisplay(value || '0');
  }, [value]);

  const handleNumber = (num: string) => {
    setDisplay((prev) => {
      if (prev === '0') return num;
      if (prev.includes('.') && num === '.') return prev;
      if (prev.length >= 5) return prev;
      return prev + num;
    });
  };

  const handleBackspace = () => {
    setDisplay((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleClearFull = () => {
    setDisplay('0');
  };

  const handleCTouchStart = () => {
    setIsCHeld(false);
    cTimeoutRef.current = setTimeout(() => {
      setIsCHeld(true);
      handleClearFull();
    }, 500); // 500ms hold to clear
  };

  const handleCTouchEnd = () => {
    if (cTimeoutRef.current) {
      clearTimeout(cTimeoutRef.current);
      cTimeoutRef.current = null;
    }
    // If not held long enough, do backspace instead
    if (!isCHeld) {
      handleBackspace();
    }
    setIsCHeld(false);
  };

  const handleDecimal = () => {
    if (!display.includes('.')) {
      setDisplay((prev) => prev + '.');
    }
  };

  const handleSubmit = () => {
    const num = parseFloat(display) || 0;
    onValueChange(num.toString());
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg md:rounded-2xl shadow-xl p-4 md:p-6">
      <div className="mb-2 md:mb-3">
        <div className="text-4xl md:text-6xl font-black text-right mb-2 md:mb-3 p-3 md:p-6 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg md:rounded-xl border-4 border-blue-300">
          {display} miles
        </div>
      </div>

      <div className="space-y-1 md:space-y-2">
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

        {/* Row 4: C 0 . (period inline) */}
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

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          className="w-full bg-gradient-to-br from-lime-400 to-lime-500 hover:from-lime-500 hover:to-lime-600 text-gray-900 p-4 md:p-6 rounded-lg md:rounded-xl text-lg md:text-2xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation mt-2 md:mt-3"
        >
          ✓ Set Miles
        </button>

      </div>
    </div>
  );
}
