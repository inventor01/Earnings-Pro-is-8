import React, { createContext, useContext, useState, useEffect } from 'react';

interface SimpleModeContextType {
  isSimple: boolean;
  setIsSimple: (value: boolean) => void;
}

const SimpleModeContext = createContext<SimpleModeContextType | undefined>(undefined);

export function SimpleModeProvider({ children }: { children: React.ReactNode }) {
  const [isSimple, setIsSimpleState] = useState<boolean>(() => {
    const saved = localStorage.getItem('simpleMode');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('simpleMode', isSimple.toString());
  }, [isSimple]);

  const setIsSimple = (value: boolean) => {
    setIsSimpleState(value);
  };

  return (
    <SimpleModeContext.Provider value={{ isSimple, setIsSimple }}>
      {children}
    </SimpleModeContext.Provider>
  );
}

export function useSimpleMode() {
  const context = useContext(SimpleModeContext);
  if (!context) {
    throw new Error('useSimpleMode must be used within SimpleModeProvider');
  }
  return context;
}
