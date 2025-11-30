export type ThemeName = 'ninja-dark';

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
  'ninja-dark': {
    name: 'ninja-dark',
    label: 'Dark Mode',
    dashBg: 'bg-gray-900',
    dashFrom: 'from-gray-900',
    dashTo: 'to-gray-800',
    dashVia: 'via-gray-850',
    
    kpiColors: {
      green: { glow: 'text-lime-300', accent: 'text-lime-200', border: 'border-lime-500', bg: 'bg-gradient-to-br from-gray-900 to-gray-800 border-lime-600' },
      red: { glow: 'text-red-300', accent: 'text-red-200', border: 'border-red-500', bg: 'bg-gradient-to-br from-gray-900 to-gray-800 border-red-600' },
      blue: { glow: 'text-yellow-300', accent: 'text-yellow-200', border: 'border-yellow-500', bg: 'bg-gradient-to-br from-gray-900 to-gray-800 border-yellow-600' },
      purple: { glow: 'text-green-300', accent: 'text-green-200', border: 'border-green-500', bg: 'bg-gradient-to-br from-gray-900 to-gray-800 border-green-600' },
      orange: { glow: 'text-yellow-300', accent: 'text-yellow-200', border: 'border-yellow-500', bg: 'bg-gradient-to-br from-gray-900 to-gray-800 border-yellow-600' },
      gray: { glow: 'text-lime-300', accent: 'text-lime-200', border: 'border-lime-500', bg: 'bg-gradient-to-br from-gray-900 to-gray-800 border-lime-600' },
    },
    
    titleColor: 'text-yellow-300',
    textPrimary: 'text-gray-100',
    textSecondary: 'text-lime-400',
    
    chipInactive: 'bg-gray-800 text-gray-300 border-2 border-gray-700 hover:bg-gray-700',
    chipActive: 'text-gray-100 border-2 border-yellow-500',
    chipActiveBg: 'bg-yellow-500',
    
    tableBg: 'bg-gray-800 border border-gray-700',
    tableHeader: 'bg-gray-800 border-b border-gray-700',
    tableHeaderText: 'text-lime-300',
    tableRow: 'text-gray-200',
    tableRowHover: 'hover:bg-gray-700',
    tableRowSelected: 'bg-gray-700 border-l-4 border-yellow-500',
    
    buttonPrimary: 'bg-lime-600 hover:bg-lime-700',
    buttonPrimaryText: 'text-white font-bold',
    
    textGreen: 'text-lime-400',
    textRed: 'text-red-400',
    textCyan: 'text-yellow-400',
  },
};

export function getTheme(name: ThemeName): ThemeConfig {
  return THEMES[name];
}

export function getAllThemes(): Array<{ name: ThemeName; label: string }> {
  return [{ name: 'ninja-dark', label: 'Dark Mode' }];
}
