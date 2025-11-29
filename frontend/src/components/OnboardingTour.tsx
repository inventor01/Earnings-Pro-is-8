import { useState } from 'react';
import { useTheme } from '../lib/themeContext';

interface OnboardingTourProps {
  isOpen: boolean;
  onComplete: () => void;
  onStepChange?: (step: number) => void;
}

interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string; // Element selector to highlight
  position: 'top' | 'bottom' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Earnings Ninja',
    description: 'Track your delivery driver earnings across all gig platforms. Let\'s take a quick tour to get you started!',
    target: 'body',
    position: 'bottom',
  },
  {
    id: 'search',
    title: 'Search Your Transactions',
    description: 'Quickly find any transaction by searching for notes, platforms, categories, types, or amounts. Type to filter in real-time!',
    target: '[data-tour="search"]',
    position: 'bottom',
  },
  {
    id: 'export',
    title: 'Export Your Data',
    description: 'Download your earnings data as CSV for any timeframe. Perfect for taxes, analysis, and record-keeping.',
    target: '[data-tour="export"]',
    position: 'bottom',
  },
  {
    id: 'timeframe',
    title: 'Filter by Timeframe',
    description: 'View earnings for Today, Yesterday, This Week, Last 7 Days, This Month, or Last Month. Click any period to switch.',
    target: '[data-tour="timeframe"]',
    position: 'bottom',
  },
  {
    id: 'performance',
    title: 'Performance Overview',
    description: 'See your key metrics at a glance: Revenue, Expenses, Profit, Miles, Orders, and Average Order Value. Click Settings to customize which metrics display.',
    target: '[data-tour="performance"]',
    position: 'top',
  },
  {
    id: 'kpis',
    title: 'KPI Cards',
    description: 'Deep-dive metrics showing $/Mile efficiency, $/Hour earnings, revenue breakdown, and more. Scroll right to see all cards.',
    target: '[data-tour="kpis"]',
    position: 'top',
  },
  {
    id: 'calculator',
    title: 'Add Entries - Calculator Mode',
    description: 'Click "+ Add Entry" to open the calculator. Choose + for Revenue or - for Expenses, then select your delivery app or expense category.',
    target: '[data-tour="calculator"]',
    position: 'top',
  },
  {
    id: 'entries-table',
    title: 'Your Transaction History',
    description: 'All entries show here with details: date, platform, amount, miles, and notes. Click the eye icon to view, pencil to edit, or X to delete.',
    target: '[data-tour="entries"]',
    position: 'top',
  },
  {
    id: 'settings',
    title: 'Settings & Customization',
    description: 'Click the gear icon to change themes (Dark Neon, Simple Light, B/W Neon), toggle metrics, or reset data. Themes save automatically!',
    target: '[data-tour="settings"]',
    position: 'bottom',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start tracking your earnings by clicking "+ Add Entry". Remember: search any transaction, export your data, and customize your dashboard. Happy earning! 🚗',
    target: 'body',
    position: 'bottom',
  },
];

export function OnboardingTour({ isOpen, onComplete, onStepChange }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { config } = useTheme();
  const isDarkTheme = true;
  
  const step = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onComplete}
      />

      {/* Tour Tooltip */}
      <div 
        className={`fixed z-50 max-w-md p-6 rounded-2xl shadow-2xl transition-all duration-300 ${
          isDarkTheme
            ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/50 text-white'
            : 'bg-white border border-blue-300 text-gray-900'
        }`}
        style={{
          top: currentStep === 0 ? '50%' : 'auto',
          left: '50%',
          transform: currentStep === 0 ? 'translate(-50%, -50%)' : 'translateX(-50%)',
          bottom: currentStep !== 0 ? '100px' : 'auto',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <h2 className={`text-xl font-black ${isDarkTheme ? 'text-cyan-300' : 'text-blue-600'}`}>
            {step.title}
          </h2>
          <button
            onClick={onComplete}
            className={`text-sm font-bold px-3 py-1 rounded ${
              isDarkTheme
                ? 'text-slate-400 hover:text-white bg-slate-700/50'
                : 'text-gray-600 hover:text-gray-900 bg-gray-100'
            }`}
          >
            Skip
          </button>
        </div>

        {/* Description */}
        <p className={`text-sm mb-6 leading-relaxed ${isDarkTheme ? 'text-slate-300' : 'text-gray-700'}`}>
          {step.description}
        </p>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${isDarkTheme ? 'from-cyan-400 to-blue-500' : 'from-blue-400 to-blue-600'} transition-all duration-300`}
              style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
            />
          </div>
          <span className={`text-xs font-bold whitespace-nowrap ${isDarkTheme ? 'text-slate-400' : 'text-gray-600'}`}>
            {currentStep + 1} / {tourSteps.length}
          </span>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              currentStep === 0
                ? isDarkTheme
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : isDarkTheme
                ? 'bg-slate-700 text-white hover:bg-slate-600'
                : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
            }`}
          >
            ← Back
          </button>
          <button
            onClick={handleNext}
            className={`flex-1 px-4 py-2 rounded-lg font-bold text-white transition-all ${
              isDarkTheme
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
            }`}
          >
            {isLastStep ? 'Get Started →' : 'Next →'}
          </button>
        </div>
      </div>
    </>
  );
}
