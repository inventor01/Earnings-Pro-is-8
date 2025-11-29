export type ThemeName = 'dark-neon' | 'simple-light' | 'ninja-green';

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
  'dark-neon': {
    name: 'dark-neon',
    label: 'Dark Neon',
    dashBg: 'bg-gradient-to-b',
    dashFrom: 'from-gray-950',
    dashTo: 'to-gray-950',
    dashVia: 'via-slate-900',
    
    kpiColors: {
      green: { glow: 'from-green-400 to-green-600', accent: 'text-green-400', border: 'border-green-500', bg: 'bg-green-900/20' },
      red: { glow: 'from-red-400 to-red-600', accent: 'text-red-400', border: 'border-red-500', bg: 'bg-red-900/20' },
      blue: { glow: 'from-blue-400 to-blue-600', accent: 'text-blue-400', border: 'border-blue-500', bg: 'bg-blue-900/20' },
      purple: { glow: 'from-purple-400 to-purple-600', accent: 'text-purple-400', border: 'border-purple-500', bg: 'bg-purple-900/20' },
      orange: { glow: 'from-orange-400 to-orange-600', accent: 'text-orange-400', border: 'border-orange-500', bg: 'bg-orange-900/20' },
      gray: { glow: 'from-gray-400 to-gray-600', accent: 'text-gray-400', border: 'border-gray-500', bg: 'bg-gray-900/20' },
    },
    
    titleColor: 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400',
    textPrimary: 'text-cyan-400',
    textSecondary: 'text-slate-400',
    
    chipInactive: 'bg-slate-800 text-slate-300 border border-slate-700',
    chipActive: 'text-white',
    chipActiveBg: 'bg-gradient-to-r from-cyan-500 to-blue-500',
    
    tableBg: 'bg-slate-800/40 border border-slate-700',
    tableHeader: 'bg-slate-900/60 border-b border-slate-700',
    tableHeaderText: 'text-cyan-400',
    tableRow: 'text-slate-300',
    tableRowHover: 'hover:bg-slate-700/30',
    tableRowSelected: 'bg-cyan-500/10 border-l-2 border-cyan-400',
    
    buttonPrimary: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600',
    buttonPrimaryText: 'text-white',
    
    textGreen: 'text-green-400',
    textRed: 'text-red-400',
    textCyan: 'text-cyan-400',
  },
  
  'simple-light': {
    name: 'simple-light',
    label: 'Simple Light',
    dashBg: 'bg-gradient-to-b',
    dashFrom: 'from-gray-50',
    dashTo: 'to-white',
    dashVia: 'via-gray-100',
    
    kpiColors: {
      green: { glow: 'from-green-400 to-green-600', accent: 'text-green-600', border: 'border-green-200', bg: 'bg-green-50' },
      red: { glow: 'from-red-400 to-red-600', accent: 'text-red-600', border: 'border-red-200', bg: 'bg-red-50' },
      blue: { glow: 'from-blue-400 to-blue-600', accent: 'text-blue-600', border: 'border-blue-200', bg: 'bg-blue-50' },
      purple: { glow: 'from-purple-400 to-purple-600', accent: 'text-purple-600', border: 'border-purple-200', bg: 'bg-purple-50' },
      orange: { glow: 'from-orange-400 to-orange-600', accent: 'text-orange-600', border: 'border-orange-200', bg: 'bg-orange-50' },
      gray: { glow: 'from-gray-400 to-gray-600', accent: 'text-gray-600', border: 'border-gray-200', bg: 'bg-gray-50' },
    },
    
    titleColor: 'text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600',
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-600',
    
    chipInactive: 'bg-gray-100 text-gray-700 border border-gray-200',
    chipActive: 'text-white',
    chipActiveBg: 'bg-gradient-to-r from-blue-500 to-blue-600',
    
    tableBg: 'bg-white border border-gray-200',
    tableHeader: 'bg-gray-50 border-b border-gray-200',
    tableHeaderText: 'text-gray-700',
    tableRow: 'text-gray-800',
    tableRowHover: 'hover:bg-gray-50',
    tableRowSelected: 'bg-blue-50 border-l-2 border-blue-500',
    
    buttonPrimary: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600',
    buttonPrimaryText: 'text-white',
    
    textGreen: 'text-green-600',
    textRed: 'text-red-600',
    textCyan: 'text-blue-600',
  },

  'ninja-green': {
    name: 'ninja-green',
    label: 'Ninja Green',
    dashBg: 'bg-lime-50',
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
    
    chipInactive: 'bg-lime-100 text-green-900 border border-lime-500',
    chipActive: 'text-white',
    chipActiveBg: 'bg-lime-500',
    
    tableBg: 'bg-white border border-lime-500',
    tableHeader: 'bg-lime-200 border-b border-lime-500',
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
  return THEMES[name] || THEMES['dark-neon'];
}

export function getAllThemes(): Array<{ name: ThemeName; label: string }> {
  return Object.values(THEMES).map(t => ({ name: t.name, label: t.label }));
}
