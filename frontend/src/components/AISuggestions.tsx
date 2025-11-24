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
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl p-4 hover:from-purple-100 hover:to-indigo-100 transition-all text-left"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💡</span>
            <div>
              <h3 className="text-lg font-black text-gray-900">AI Earning Tips</h3>
              <p className="text-sm text-gray-600">
                {suggestions.total_orders} orders • Min: ${suggestions.minimum_order} • Peak: {suggestions.peak_time}
              </p>
            </div>
          </div>
          <span className={`text-2xl transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 bg-white border-2 border-purple-200 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="text-2xl">📊</span>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-2">Your Stats</h4>
                <div className="text-sm text-gray-700 space-y-1">
                  <p>
                    <span className="font-semibold">Average Order:</span> ${suggestions.average_order}
                  </p>
                  <p>
                    <span className="font-semibold">Total Orders:</span> {suggestions.total_orders}
                  </p>
                  <p>
                    <span className="font-semibold">Suggested Minimum:</span> ${suggestions.minimum_order}
                  </p>
                  {suggestions.peak_time && (
                    <p>
                      <span className="font-semibold">Peak Earning Time:</span> {suggestions.peak_time}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t-2 border-purple-100 pt-4">
              <div className="flex gap-3">
                <span className="text-2xl">🎯</span>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-2">AI Suggestions</h4>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {suggestions.suggestion}
                  </p>
                </div>
              </div>
            </div>

            {suggestions.reasoning && (
              <div className="text-xs text-gray-500 italic pt-2">
                Based on: {suggestions.reasoning}
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
