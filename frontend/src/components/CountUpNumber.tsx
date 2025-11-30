import { useEffect, useState } from 'react';

interface CountUpNumberProps {
  value: string | number;
  duration?: number;
  wholeNumberOnly?: boolean;
}

export function CountUpNumber({ value, duration = 800, wholeNumberOnly = false }: CountUpNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  
  useEffect(() => {
    // Extract numeric value
    const numericValue = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    const isNegative = numericValue < 0;
    const absValue = Math.abs(numericValue);
    
    if (isNaN(absValue)) {
      setDisplayValue(value);
      return;
    }

    let startTime: number;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const currentValue = absValue * progress;
      const prefix = String(value).match(/[^0-9.-]/g)?.[0] || '';
      
      // Format based on original format
      let formatted = '';
      if (prefix === '$') {
        // Always show whole numbers only (no decimals)
        formatted = `$${Math.round(currentValue)}`;
      } else {
        // For non-currency values, use whole number if requested
        formatted = wholeNumberOnly ? String(Math.round(currentValue)) : String(currentValue.toFixed(1));
      }

      setDisplayValue(isNegative ? `-${formatted}` : formatted);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration, wholeNumberOnly]);

  return <>{displayValue}</>;
}
