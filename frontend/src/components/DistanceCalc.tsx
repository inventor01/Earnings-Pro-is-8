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

  const handleBackspace = () => {
    setDisplay((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
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
    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-lg md:rounded-xl p-3 md:p-4">
      <label className="block text-sm md:text-base font-bold text-blue-900 mb-2 md:mb-3">
        🛣️ Distance (miles)
      </label>

      {/* Display */}
      <div className="bg-white border-2 border-blue-400 rounded-lg md:rounded-xl p-3 md:p-4 mb-3 md:mb-4 text-right">
        <div className="text-2xl md:text-3xl font-bold text-blue-900 font-mono">
          {display}
        </div>
      </div>

      {/* Calculator Grid */}
      <div className="grid grid-cols-4 gap-2">
        {/* Row 1 */}
        <button
          onClick={() => handleNumber('7')}
          className="bg-white border-2 border-blue-300 rounded p-2 md:p-3 font-bold text-lg md:text-xl hover:bg-blue-50 transition-colors"
        >
          7
        </button>
        <button
          onClick={() => handleNumber('8')}
          className="bg-white border-2 border-blue-300 rounded p-2 md:p-3 font-bold text-lg md:text-xl hover:bg-blue-50 transition-colors"
        >
          8
        </button>
        <button
          onClick={() => handleNumber('9')}
          className="bg-white border-2 border-blue-300 rounded p-2 md:p-3 font-bold text-lg md:text-xl hover:bg-blue-50 transition-colors"
        >
          9
        </button>
        <button
          onClick={handleBackspace}
          className="bg-red-500 hover:bg-red-600 text-white border-2 border-red-600 rounded p-2 md:p-3 font-bold text-lg md:text-xl transition-colors"
        >
          ⌫
        </button>

        {/* Row 2 */}
        <button
          onClick={() => handleNumber('4')}
          className="bg-white border-2 border-blue-300 rounded p-2 md:p-3 font-bold text-lg md:text-xl hover:bg-blue-50 transition-colors"
        >
          4
        </button>
        <button
          onClick={() => handleNumber('5')}
          className="bg-white border-2 border-blue-300 rounded p-2 md:p-3 font-bold text-lg md:text-xl hover:bg-blue-50 transition-colors"
        >
          5
        </button>
        <button
          onClick={() => handleNumber('6')}
          className="bg-white border-2 border-blue-300 rounded p-2 md:p-3 font-bold text-lg md:text-xl hover:bg-blue-50 transition-colors"
        >
          6
        </button>
        <button
          onClick={handleClear}
          className="bg-orange-500 hover:bg-orange-600 text-white border-2 border-orange-600 rounded p-2 md:p-3 font-bold text-lg md:text-xl transition-colors"
        >
          C
        </button>

        {/* Row 3 */}
        <button
          onClick={() => handleNumber('1')}
          className="bg-white border-2 border-blue-300 rounded p-2 md:p-3 font-bold text-lg md:text-xl hover:bg-blue-50 transition-colors"
        >
          1
        </button>
        <button
          onClick={() => handleNumber('2')}
          className="bg-white border-2 border-blue-300 rounded p-2 md:p-3 font-bold text-lg md:text-xl hover:bg-blue-50 transition-colors"
        >
          2
        </button>
        <button
          onClick={() => handleNumber('3')}
          className="bg-white border-2 border-blue-300 rounded p-2 md:p-3 font-bold text-lg md:text-xl hover:bg-blue-50 transition-colors"
        >
          3
        </button>
        <button
          onClick={handleDecimal}
          className="bg-purple-500 hover:bg-purple-600 text-white border-2 border-purple-600 rounded p-2 md:p-3 font-bold text-lg md:text-xl transition-colors"
        >
          .
        </button>

        {/* Row 4 */}
        <button
          onClick={() => handleNumber('0')}
          className="bg-white border-2 border-blue-300 rounded p-2 md:p-3 font-bold text-lg md:text-xl hover:bg-blue-50 transition-colors col-span-2"
        >
          0
        </button>
        <button
          onClick={handleSubmit}
          className="bg-green-500 hover:bg-green-600 text-white border-2 border-green-600 rounded p-2 md:p-3 font-bold text-lg md:text-xl transition-colors col-span-2"
        >
          ✓
        </button>
      </div>
    </div>
  );
}
