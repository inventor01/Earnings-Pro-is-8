import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface AISuggestionsProps {
  fromDate?: string;
  toDate?: string;
}

export function AISuggestions({ fromDate, toDate }: AISuggestionsProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: suggestions, isLoading, error } = useQuery({
    queryKey: ['suggestions', fromDate, toDate],
    queryFn: () => api.getSuggestions(fromDate, toDate),
    staleTime: 60000, // 1 minute
    enabled: !!fromDate && !!toDate,
  });

  if (isLoading) {
    return (
      <div className="mb-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <span className="text-3xl">💡</span>
          <div className="flex-1">
            <div className="h-6 bg-purple-200 rounded w-32 mb-2"></div>
            <div className="h-4 bg-purple-100 rounded w-48"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!suggestions) {
    return null;
  }

  return (
    <div className="mb-4 md:mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-lg md:rounded-xl p-3 md:p-4 hover:from-purple-100 hover:to-indigo-100 transition-all text-left active:scale-95"
      >
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <span className="text-xl md:text-3xl flex-shrink-0">💡</span>
            <div className="min-w-0">
              <h3 className="text-base md:text-lg font-black text-gray-900">AI Tips</h3>
              <p className="text-xs md:text-sm text-gray-600 truncate">
                {suggestions.total_orders} orders • Min: ${suggestions.minimum_order}
              </p>
            </div>
          </div>
          <span className={`text-lg md:text-2xl transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-2 md:mt-4 bg-white border-2 border-purple-200 rounded-lg md:rounded-xl p-4 md:p-6 space-y-3 md:space-y-4 shadow-sm">
          <div className="space-y-3">
            <div className="flex gap-2 md:gap-3">
              <span className="text-xl md:text-2xl flex-shrink-0">📊</span>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 mb-1 md:mb-2 text-sm md:text-base">Your Stats</h4>
                <div className="text-xs md:text-sm text-gray-700 space-y-0.5">
                  <p>
                    <span className="font-semibold">Avg Order:</span> ${suggestions.average_order}
                  </p>
                  <p>
                    <span className="font-semibold">Orders:</span> {suggestions.total_orders}
                  </p>
                  <p>
                    <span className="font-semibold">Min Accept:</span> ${suggestions.minimum_order}
                  </p>
                  {suggestions.peak_time && (
                    <p>
                      <span className="font-semibold">Peak:</span> {suggestions.peak_time}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t-2 border-purple-100 pt-3">
              <div className="flex gap-2 md:gap-3">
                <span className="text-xl md:text-2xl flex-shrink-0">🎯</span>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <h4 className="font-bold text-gray-900 mb-1 md:mb-2 text-sm md:text-base">Suggestions</h4>
                  <p className="text-xs md:text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {suggestions.suggestion}
                  </p>
                </div>
              </div>
            </div>

            {suggestions.reasoning && (
              <div className="text-xs text-gray-500 italic pt-1 md:pt-2">
                {suggestions.reasoning}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          Could not load suggestions. Try again later.
        </div>
      )}
    </div>
  );
}
