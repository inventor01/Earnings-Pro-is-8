import { useState, useEffect } from 'react';

interface DistanceCalcProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function DistanceCalc({ value, onValueChange }: DistanceCalcProps) {
  const [display, setDisplay] = useState(value || '0');

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

  const handleClear = () => {
    setDisplay('0');
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
      <div className="mb-4 md:mb-6">
        <div className="text-4xl md:text-6xl font-black text-right mb-3 md:mb-6 p-3 md:p-6 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg md:rounded-xl border-4 border-blue-300">
          {display} mi
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

        {/* Row 4: C 0 . (period inline) */}
        <div className="grid grid-cols-3 gap-2 md:gap-3 w-full">
          <button
            onClick={handleClear}
            className="w-full bg-gradient-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white p-4 md:p-6 rounded-lg md:rounded-xl text-lg md:text-2xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-105 active:scale-95 touch-manipulation"
          >
            C
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

      </div>
    </div>
  );
}
