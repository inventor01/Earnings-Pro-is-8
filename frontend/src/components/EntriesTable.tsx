import { useState } from 'react';
import { Entry } from '../lib/api';
import { useTheme } from '../lib/themeContext';
import { formatDateEST } from '../lib/dateUtils';
import doordashLogo from '../assets/doordash-logo.png';
import ubereatsLogo from '../assets/ubereats-logo.png';
import ubereatsLogoDark from '../assets/ubereats-dark.png';
import instacartLogo from '../assets/instacart-logo.png';
import instacartLogoDark from '../assets/instacart-dark.png';
import grubhubLogo from '../assets/grubhub-logo.png';
import shiptLogo from '../assets/shipt-logo.png';

interface EntriesTableProps {
  entries: Entry[];
  onDelete?: (id: number) => void;
  onEdit?: (entry: Entry) => void;
  onView?: (entry: Entry) => void;
  selectedIds?: number[];
  onSelectChange?: (ids: number[]) => void;
  period?: string; // 'today', 'yesterday', 'week', 'last7', 'month', etc.
}

type SortField = 'date' | 'time' | 'amount' | 'type' | 'app' | 'miles';
type SortOrder = 'asc' | 'desc';

export function EntriesTable({ entries, onDelete, onEdit, onView, selectedIds = [], onSelectChange, period }: EntriesTableProps) {
  const { config } = useTheme();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const allSelected = entries.length > 0 && selectedIds.length === entries.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < entries.length;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectChange?.([]);
    } else {
      onSelectChange?.(entries.map(e => e.id));
    }
  };

  const handleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      onSelectChange?.(selectedIds.filter(i => i !== id));
    } else {
      onSelectChange?.([...selectedIds, id]);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getSortedEntries = () => {
    const sorted = [...entries];

    if (!sortField) {
      // Default sort: by date descending (newest first)
      return sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    sorted.sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case 'date':
        case 'time':
          aVal = new Date(a.timestamp).getTime();
          bVal = new Date(b.timestamp).getTime();
          break;
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'app':
          aVal = a.type === 'EXPENSE' ? (a.category || 'OTHER') : a.app;
          bVal = b.type === 'EXPENSE' ? (b.category || 'OTHER') : b.app;
          break;
        case 'miles':
          aVal = a.distance_miles;
          bVal = b.distance_miles;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return sorted;
  };

  const getTypeIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      'ORDER': 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
      'BONUS': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z',
      'EXPENSE': 'M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z',
      'CANCELLATION': 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z'
    };
    return iconMap[type] || 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z';
  };

  const getAppLogo = (app: string): string | null => {
    const isLightTheme = config.name === 'simple-light';
    
    switch (app) {
      case 'DOORDASH':
        return doordashLogo;
      case 'UBEREATS':
        return isLightTheme ? ubereatsLogo : null;
      case 'INSTACART':
        return isLightTheme ? instacartLogo : instacartLogoDark;
      case 'GRUBHUB':
        return grubhubLogo;
      case 'SHIPT':
        return shiptLogo;
      default:
        return null;
    }
  };

  const getFormattedAppName = (app: string): string => {
    const nameMap: Record<string, string> = {
      'UBEREATS': 'Uber Eats',
      'DOORDASH': 'DoorDash',
      'INSTACART': 'Instacart',
      'GRUBHUB': 'GrubHub',
      'SHIPT': 'Shipt'
    };
    return nameMap[app] || app;
  };

  const getAppColor = (app: string) => {
    const isBWTheme = config.name === 'bw-neon';
    const isLightTheme = config.name === 'simple-light';
    
    if (isBWTheme) {
      return 'border border-white text-white bg-black';
    }
    
    // Light theme uses outline style
    if (isLightTheme) {
      switch (app) {
        case 'DOORDASH':
          return 'border-2 border-red-500 text-red-600 bg-transparent';
        case 'UBEREATS':
          return 'border-2 border-green-500 text-green-600 bg-transparent';
        case 'INSTACART':
          return 'border-2 border-orange-500 text-orange-600 bg-transparent';
        case 'GRUBHUB':
          return 'border-2 border-yellow-500 text-yellow-600 bg-transparent';
        case 'SHIPT':
          return 'border-2 border-lime-500 text-lime-600 bg-transparent';
        default:
          return 'border-2 border-gray-500 text-gray-600 bg-transparent';
      }
    }
    
    // Dark theme uses outline style
    switch (app) {
      case 'DOORDASH':
        return 'border-2 border-red-500 text-red-400 bg-transparent';
      case 'UBEREATS':
        return 'border-2 border-green-500 text-green-400 bg-transparent';
      case 'INSTACART':
        return 'border-2 border-orange-500 text-orange-400 bg-transparent';
      case 'GRUBHUB':
        return 'border-2 border-yellow-500 text-yellow-400 bg-transparent';
      case 'SHIPT':
        return 'border-2 border-lime-500 text-lime-400 bg-transparent';
      default:
        return 'border-2 border-gray-500 text-gray-400 bg-transparent';
    }
  };

  const getCategoryColor = (category: string) => {
    const isBWTheme = config.name === 'bw-neon';
    const isLightTheme = config.name === 'simple-light';
    
    if (isBWTheme) {
      return 'border border-white text-white bg-black';
    }
    
    // Light theme uses outline style
    if (isLightTheme) {
      switch (category) {
        case 'GAS':
          return 'border-2 border-green-700 text-green-800 bg-transparent';
        case 'PARKING':
          return 'border-2 border-green-700 text-green-800 bg-transparent';
        case 'TOLLS':
          return 'border-2 border-green-700 text-green-800 bg-transparent';
        case 'MAINTENANCE':
          return 'border-2 border-lime-500 text-lime-600 bg-transparent';
        case 'PHONE':
          return 'border-2 border-pink-500 text-pink-600 bg-transparent';
        case 'SUBSCRIPTION':
          return 'border-2 border-violet-500 text-violet-600 bg-transparent';
        case 'FOOD':
          return 'border-2 border-amber-500 text-amber-600 bg-transparent';
        case 'LEISURE':
          return 'border-2 border-rose-500 text-rose-600 bg-transparent';
        default:
          return 'border-2 border-gray-500 text-gray-600 bg-transparent';
      }
    }
    
    // Dark theme uses outline style
    switch (category) {
      case 'GAS':
        return 'border-2 border-green-700 text-green-600 bg-transparent';
      case 'PARKING':
        return 'border-2 border-green-700 text-green-600 bg-transparent';
      case 'TOLLS':
        return 'border-2 border-green-700 text-green-600 bg-transparent';
      case 'MAINTENANCE':
        return 'border-2 border-lime-500 text-lime-400 bg-transparent';
      case 'PHONE':
        return 'border-2 border-pink-500 text-pink-400 bg-transparent';
      case 'SUBSCRIPTION':
        return 'border-2 border-violet-500 text-violet-400 bg-transparent';
      case 'FOOD':
        return 'border-2 border-amber-500 text-amber-400 bg-transparent';
      case 'LEISURE':
        return 'border-2 border-rose-500 text-rose-400 bg-transparent';
      default:
        return 'border-2 border-gray-500 text-gray-400 bg-transparent';
    }
  };

  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, string> = {
      'GAS': 'M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23Z',
      'PARKING': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z',
      'TOLLS': 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm11 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM5 12l2-6h10l2 6H5z',
      'MAINTENANCE': 'M9.5 3C7.57 3 6 4.57 6 6.5c0 .89.35 1.69.91 2.28L2.29 15.86c-.39.39-.39 1.02 0 1.41l1.41 1.41c.39.39 1.02.39 1.41 0l4.62-4.62c.59.56 1.39.94 2.27.94 1.93 0 3.5-1.57 3.5-3.5S11.43 8 9.5 8c-.89 0-1.69.35-2.28.91l-4.62-4.62c-.39-.39-1.02-.39-1.41 0L0 1.41C-.39 1.8-.39 2.43 0 2.82l4.62 4.62C4.35 8.31 4 9.11 4 10c0 1.93 1.57 3.5 3.5 3.5s3.5-1.57 3.5-3.5S11.43 3 9.5 3zm0 5c-.83 0-1.5-.67-1.5-1.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm10-6h2V0h-2v2zm0 18h2v-2h-2v2zm4-9h-2v2h2v-2zM19 0v2h2V0h-2z',
      'PHONE': 'M17 10.5V7c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1v3.5C2.01 10.5 1 11.37 1 12.5v6c0 1.13 1.01 2 2.25 2h13.5c1.24 0 2.25-.87 2.25-2v-6c0-1.13-1.01-2-2.25-2zm-13 1.5h11V8H4v3.5z',
      'SUBSCRIPTION': 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
      'FOOD': 'M11.59 7.41L15.17 3.82c.39-.39 1.02-.39 1.41 0l2.83 2.83c.39.39.39 1.02 0 1.41L15.41 11.59c.54-.54.54-1.42 0-1.96l-1.41-1.41c-.55-.55-1.44-.55-1.98 0l-1.41 1.41c-.39.39-.39 1.02 0 1.41L3 21h18V3H3l8.59 8.59z',
      'LEISURE': 'M15 19.88c.04-.3.13-.59.21-.86.05-.16.09-.32.12-.48.03-.16.04-.32.04-.48 0-.36-.06-.71-.16-1.02-.04-.12-.09-.23-.14-.34-.01-.02-.01-.04-.02-.07-.01-.02-.01-.04-.02-.06-1.42-2.09-3.97-3.59-6.99-3.88V1c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v10.88c1.11-.59 1.99-1.76 1.99-3.13 0-1.97-1.49-3.6-3.37-3.99 1.35-.59 2.37-1.95 2.37-3.5 0-2.21-1.79-4-4-4s-4 1.79-4 4c0 1.54 1.01 2.89 2.37 3.5C6.49 8.27 5 9.9 5 11.88c0 1.37.88 2.54 1.99 3.13V1c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v10.88z',
      'OTHER': 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z'
    };
    return iconMap[category] || iconMap['OTHER'];
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => {
    const isActive = sortField === field;
    
    return (
      <button
        onClick={() => handleSort(field)}
        className={`px-4 py-3 text-left text-xs font-bold uppercase hover:opacity-80 transition-all w-full text-left flex items-center gap-2 ${config.tableHeaderText} ${isActive ? 'opacity-100' : 'opacity-75'}`}
        title={`Sort by ${label}`}
      >
        {label}
        <span className={`inline-flex transition-transform ${isActive && sortOrder === 'desc' ? 'rotate-180' : ''}`}>
          {isActive ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          )}
        </span>
      </button>
    );
  };

  if (entries.length === 0) {
    const isDarkTheme = config.name !== 'simple-light';
    return (
      <div className={`rounded-lg shadow p-8 text-center ${config.tableBg} ${isDarkTheme ? 'text-lime-400' : 'text-lime-600'}`}>
        No entries yet. Add your first entry using the calculator below!
      </div>
    );
  }

  const sortedEntries = getSortedEntries();

  return (
    <div className={`rounded-lg shadow overflow-hidden ${config.tableBg}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={config.tableHeader}>
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={input => {
                    if (input) {
                      input.indeterminate = someSelected;
                    }
                  }}
                  onChange={handleSelectAll}
                  className={`w-4 h-4 rounded cursor-pointer ${config.name === 'bw-neon' ? 'border-white text-white' : config.name === 'simple-light' ? 'border-blue-500 text-blue-600' : 'border-cyan-500 text-cyan-400'}`}
                />
              </th>
              <th className="px-0 py-0">
                <SortHeader field="type" label="Type" />
              </th>
              <th className="px-0 py-0">
                <SortHeader field="app" label="App / Category" />
              </th>
              <th className="px-0 py-0">
                <SortHeader field="time" label="Date / Time" />
              </th>
              <th className="px-0 py-0">
                <SortHeader field="amount" label="Amount" />
              </th>
              <th className="px-0 py-0">
                <SortHeader field="miles" label="Miles" />
              </th>
              <th className={`px-4 py-3 text-left text-xs font-bold uppercase ${config.tableHeaderText}`}>Note</th>
              <th className={`px-4 py-3 text-right text-xs font-bold uppercase ${config.tableHeaderText}`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${config.name === 'simple-light' ? 'divide-gray-200' : 'divide-slate-700'}`}>
            {sortedEntries.map((entry) => (
              <tr key={entry.id} className={`${config.tableRowHover} transition-colors ${selectedIds.includes(entry.id) ? config.tableRowSelected : ''}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(entry.id)}
                    onChange={() => handleSelectOne(entry.id)}
                    className={`w-4 h-4 rounded cursor-pointer ${config.name === 'bw-neon' ? 'border-white text-white' : config.name === 'simple-light' ? 'border-blue-500 text-blue-600' : 'border-cyan-500 text-cyan-400'}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <svg className={`w-5 h-5 ${config.name === 'simple-light' ? 'text-gray-700' : 'text-white'}`} fill="currentColor" viewBox="0 0 24 24"><path d={getTypeIcon(entry.type)}/></svg>
                    <span className={`text-sm font-bold ${config.textPrimary}`}>{entry.type}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {entry.type === 'EXPENSE' ? (
                    <span className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center gap-1 ${getCategoryColor(entry.category || 'OTHER')}`}>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={getCategoryIcon(entry.category || 'OTHER')}/></svg>
                      {entry.category || 'OTHER'}
                    </span>
                  ) : (
                    <div className={`px-1 md:px-2 py-1 rounded text-xs font-bold whitespace-nowrap inline-flex items-center justify-center ${getAppColor(entry.app)}`}>
                      {(() => {
                        const isDarkTheme = config.name !== 'simple-light';
                        const isLightTheme = config.name === 'simple-light';
                        const logoSrc = getAppLogo(entry.app);
                        return logoSrc ? (
                          <img src={logoSrc} alt={entry.app} className={`w-auto object-contain ${isLightTheme ? 'h-6 md:h-7 max-w-[90px] md:max-w-[120px]' : 'h-4 md:h-5 max-w-[60px] md:max-w-[80px]'}`} />
                        ) : (
                          <span className={isDarkTheme && entry.app === 'UBEREATS' ? 'text-white font-bold' : ''} style={isDarkTheme && entry.app === 'UBEREATS' ? { fontFamily: 'Montserrat, sans-serif', letterSpacing: '-0.02em', fontWeight: 700 } : {}}>{getFormattedAppName(entry.app)}</span>
                        );
                      })()}
                    </div>
                  )}
                </td>
                <td className={`px-4 py-3 text-sm font-bold ${config.textSecondary}`}>
                  {formatDateEST(entry.timestamp)}
                </td>
                <td className={`px-4 py-3 text-right font-black ${
                  entry.amount >= 0 ? config.textGreen : config.textRed
                }`}>
                  ${Math.abs(entry.amount).toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-right text-sm font-bold ${config.textSecondary}`}>
                  {entry.distance_miles > 0 ? `${entry.distance_miles.toFixed(1)} mi` : '-'}
                </td>
                <td className={`px-4 py-3 text-sm font-bold ${config.textSecondary}`}>
                  <div className="flex flex-col gap-1">
                    {entry.note && <span className="truncate max-w-xs font-bold">{entry.note}</span>}
                    {entry.receipt_url && (
                      <button
                        onClick={() => {
                          const img = new Image();
                          img.src = entry.receipt_url!;
                          const link = document.createElement('a');
                          link.href = entry.receipt_url!;
                          link.target = '_blank';
                          link.click();
                        }}
                        className={`text-xs font-medium flex items-center gap-1 ${config.textCyan} hover:opacity-80 transition-opacity`}
                        title="View receipt"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                        Receipt
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right space-x-2 flex justify-end">
                  <button
                    onClick={() => onView && onView(entry)}
                    className={`text-sm font-medium transition-colors ${config.textSecondary} hover:${config.textCyan}`}
                    title="View entry details"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                  </button>
                  <button
                    onClick={() => onEdit && onEdit(entry)}
                    className={`text-sm font-bold transition-colors ${config.textCyan} hover:opacity-80`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete && onDelete(entry.id)}
                    className={`text-sm font-bold transition-colors ${config.textRed} hover:opacity-80`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
