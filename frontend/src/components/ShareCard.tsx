import { useTheme } from '../lib/themeContext';
import { useRef } from 'react';
import html2canvas from 'html2canvas';

interface ShareCardProps {
  revenue: string;
  expenses: string;
  profit: string;
  miles: string;
  orders: number;
  avgOrder?: string;
  periodLabel?: string;
}

export function ShareCard({ 
  revenue, expenses, profit, miles, orders, avgOrder, periodLabel = 'Today' 
}: ShareCardProps) {
  const { config: themeConfig } = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        allowTaint: true,
        useCORS: true,
      });
      
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `earnings-pro-${periodLabel}-${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    } catch (error) {
      console.error('Failed to download card:', error);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const file = new File([blob], `earnings-pro-${periodLabel}.png`, { type: 'image/png' });
        
        if (navigator.share) {
          await navigator.share({
            title: 'My Earnings Performance',
            text: `Check out my ${periodLabel} earnings on EARNINGS PRO!`,
            files: [file],
          });
        } else {
          // Fallback: download if share API not available
          handleDownload();
        }
      });
    } catch (error) {
      console.error('Failed to share card:', error);
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Shareable Card */}
      <div
        ref={cardRef}
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-4 border-2 inline-block"
        style={{
          borderColor: themeConfig.kpiColors.blue.border,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
        }}
      >
        {/* Header */}
        <div className="mb-3 text-center">
          <div className="text-2xl font-bold mb-0.5">
            <span className="bg-gradient-to-r from-yellow-400 to-yellow-500 bg-clip-text text-transparent">EARNINGS</span>
            <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent ml-1">PRO</span>
          </div>
          <p className="text-gray-400 text-xs">{periodLabel} Performance</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Revenue */}
          <div className="bg-gradient-to-br from-green-900/30 to-green-800/10 rounded-lg p-2 border border-green-500/30">
            <p className="text-green-400 text-xs font-semibold mb-0.5">📈 REVENUE</p>
            <p className="text-green-300 text-lg font-bold break-words">${revenue}</p>
          </div>

          {/* Expenses */}
          <div className="bg-gradient-to-br from-red-900/30 to-red-800/10 rounded-lg p-2 border border-red-500/30">
            <p className="text-red-400 text-xs font-semibold mb-0.5">💸 EXPENSES</p>
            <p className="text-red-300 text-lg font-bold break-words">${expenses}</p>
          </div>

          {/* Profit */}
          <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/10 rounded-lg p-2 border border-yellow-500/30">
            <p className="text-yellow-400 text-xs font-semibold mb-0.5">💰 PROFIT</p>
            <p className="text-yellow-300 text-lg font-bold break-words">${profit}</p>
          </div>

          {/* Miles */}
          <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/10 rounded-lg p-2 border border-orange-500/30">
            <p className="text-orange-400 text-xs font-semibold mb-0.5">🛣️ MILES</p>
            <p className="text-orange-300 text-lg font-bold break-words">{miles}</p>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-600">
          <div className="text-center">
            <p className="text-gray-500 text-xs font-semibold mb-0.5">ORDERS</p>
            <p className="text-white text-sm font-bold">{orders}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs font-semibold mb-0.5">AVG ORDER</p>
            <p className="text-white text-sm font-bold break-words">${avgOrder || '0.00'}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs font-semibold mb-0.5">PERIOD</p>
            <p className="text-white text-xs font-bold">{periodLabel}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 text-center text-gray-500 text-xs">
          <p>Generated on {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Share Buttons */}
      <div className="flex gap-2 md:gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 md:py-3 rounded-lg font-bold text-sm md:text-base transition-colors flex items-center justify-center gap-1 md:gap-2"
        >
          📥 <span className="hidden sm:inline">Download</span>
        </button>
        <button
          onClick={handleShare}
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 md:py-3 rounded-lg font-bold text-sm md:text-base transition-colors flex items-center justify-center gap-1 md:gap-2"
        >
          🔗 <span className="hidden sm:inline">Share</span>
        </button>
      </div>
    </div>
  );
}
