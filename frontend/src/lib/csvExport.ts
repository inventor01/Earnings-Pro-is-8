import { Entry } from './api';
import { formatDateEST } from './dateUtils';

interface ExportData {
  entries: Entry[];
  revenue: number;
  expenses: number;
  profit: number;
  miles: number;
  timeframe: string;
}

export function generateCSV(data: ExportData): string {
  const { entries, revenue, expenses, profit, miles, timeframe } = data;
  
  // Create summary section
  const summaryLines = [
    'EARNINGS PRO - DATA EXPORT',
    `Timeframe,${timeframe}`,
    `Export Date,${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`,
    '',
    'SUMMARY',
    `Revenue,$${revenue.toFixed(2)}`,
    `Expenses,$${expenses.toFixed(2)}`,
    `Profit,$${profit.toFixed(2)}`,
    `Miles,${miles.toFixed(1)}`,
    '',
    'TRANSACTIONS',
    'Date,Type,Platform/Category,Amount,Miles,Note',
  ];

  // Create transaction lines
  const transactionLines = entries.map(entry => {
    const date = formatDateEST(entry.timestamp);
    const type = entry.type;
    const platformOrCategory = entry.type === 'EXPENSE' ? (entry.category || 'OTHER') : entry.app;
    const amount = `$${Math.abs(entry.amount).toFixed(2)}`;
    const milesStr = entry.distance_miles > 0 ? entry.distance_miles.toFixed(1) : '';
    const note = entry.note ? `"${entry.note.replace(/"/g, '""')}"` : '';
    
    return `${date},${type},${platformOrCategory},${amount},${milesStr},${note}`;
  });

  // Combine all lines
  const allLines = [...summaryLines, ...transactionLines];
  return allLines.join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToCSV(data: ExportData): void {
  const csv = generateCSV(data);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `earnings-pro-${data.timeframe.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.csv`;
  downloadCSV(csv, filename);
}
