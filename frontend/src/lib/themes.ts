export type ThemeName = 'ninja-green';

export interface ThemeConfig {
  name: ThemeName;
  label: string;
  // Dashboard background
  dashBg: string;
  dashFrom: string;
  dashTo: string;
  dashVia: string;
  
  // KPI Cards
  kpiColors: {
    green: { glow: string; accent: string; border: string; bg: string };
    red: { glow: string; accent: string; border: string; bg: string };
    blue: { glow: string; accent: string; border: string; bg: string };
    purple: { glow: string; accent: string; border: string; bg: string };
    orange: { glow: string; accent: string; border: string; bg: string };
    gray: { glow: string; accent: string; border: string; bg: string };
  };
  
  // Text colors
  titleColor: string;
  textPrimary: string;
  textSecondary: string;
  
  // Period chips
  chipInactive: string;
  chipActive: string;
  chipActiveBg: string;
  
  // Table
  tableBg: string;
  tableHeader: string;
  tableHeaderText: string;
  tableRow: string;
  tableRowHover: string;
  tableRowSelected: string;
  
  // Buttons
  buttonPrimary: string;
  buttonPrimaryText: string;
  
  // Text modifiers
  textGreen: string;
  textRed: string;
  textCyan: string;
}

export const THEMES: Record<ThemeName, ThemeConfig> = {
  'ninja-green': {
    name: 'ninja-green',
    label: 'Ninja Green',
    dashBg: 'bg-white',
    dashFrom: '',
    dashTo: '',
    dashVia: '',
    
    kpiColors: {
      green: { glow: 'text-lime-500', accent: 'text-green-900', border: 'border-lime-500', bg: 'bg-lime-100' },
      red: { glow: 'text-red-500', accent: 'text-red-900', border: 'border-red-500', bg: 'bg-red-100' },
      blue: { glow: 'text-yellow-500', accent: 'text-yellow-900', border: 'border-yellow-500', bg: 'bg-yellow-100' },
      purple: { glow: 'text-green-700', accent: 'text-green-900', border: 'border-green-600', bg: 'bg-green-100' },
      orange: { glow: 'text-yellow-500', accent: 'text-yellow-900', border: 'border-yellow-500', bg: 'bg-yellow-100' },
      gray: { glow: 'text-lime-500', accent: 'text-green-900', border: 'border-lime-400', bg: 'bg-lime-50' },
    },
    
    titleColor: 'text-green-800',
    textPrimary: 'text-green-900',
    textSecondary: 'text-lime-600',
    
    chipInactive: 'bg-lime-100 text-gray-700 border-2 border-lime-300 hover:bg-lime-200',
    chipActive: 'text-gray-900 border-2 border-yellow-500',
    chipActiveBg: 'bg-yellow-400',
    
    tableBg: 'bg-white border border-lime-500',
    tableHeader: 'bg-lime-100 border-b border-lime-500',
    tableHeaderText: 'text-green-900',
    tableRow: 'text-gray-900',
    tableRowHover: 'hover:bg-yellow-50',
    tableRowSelected: 'bg-yellow-100 border-l-4 border-yellow-500',
    
    buttonPrimary: 'bg-lime-500 hover:bg-lime-600',
    buttonPrimaryText: 'text-white font-bold',
    
    textGreen: 'text-lime-600',
    textRed: 'text-red-700',
    textCyan: 'text-yellow-600',
  },
};

export function getTheme(name: ThemeName): ThemeConfig {
  return THEMES[name] || THEMES['ninja-green'];
}

export function getAllThemes(): Array<{ name: ThemeName; label: string }> {
  return Object.values(THEMES).map(t => ({ name: t.name, label: t.label }));
}
