import { useState, useEffect } from 'react';
import { useTheme } from '../lib/themeContext';

interface TourStep {
  id: string;
  title: string;
  description: string;
  selector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'hero',
    title: '🚗 Welcome to EARNINGS PRO',
    description: 'Track your delivery earnings across all gig platforms with real-time insights and analytics.',
    position: 'bottom',
  },
  {
    id: 'periods',
    title: '📅 Time Period Filtering',
    description: 'Switch between different time periods (Today, Yesterday, This Week, This Month, etc.) to analyze your earnings.',
    selector: '[data-tour="periods"]',
    position: 'bottom',
  },
  {
    id: 'search',
    title: '🔍 Transaction Search',
    description: 'Quickly search and filter your transactions by note, platform, category, type, or amount in real-time.',
    selector: '[data-tour="search"]',
    position: 'bottom',
  },
  {
    id: 'performance',
    title: '📊 Performance Overview',
    description: 'View your key metrics: Revenue, Expenses, Profit, Miles, Orders, and Average Order Value. Share your performance card!',
    selector: '[data-tour="performance"]',
    position: 'bottom',
  },
  {
    id: 'kpis',
    title: '💡 Advanced Metrics',
    description: 'Check $/Mile, $/Hour, and other efficiency metrics to optimize your earnings strategy.',
    selector: '[data-tour="kpis"]',
    position: 'bottom',
  },
  {
    id: 'calculator',
    title: '🧮 Calculator Input',
    description: 'Quickly add entries using the calculator interface. Choose Add or Subtract mode for flexibility.',
    selector: '[data-tour="calculator"]',
    position: 'top',
  },
  {
    id: 'entries',
    title: '📝 Transaction History',
    description: 'View, edit, and manage all your transactions with bulk delete and selection options.',
    selector: '[data-tour="entries"]',
    position: 'top',
  },
  {
    id: 'settings',
    title: '⚙️ Settings & Customization',
    description: 'Configure profit goals, choose your theme, connect platforms, and manage preferences.',
    selector: '[data-tour="settings"]',
    position: 'left',
  },
  {
    id: 'export',
    title: '📥 Data Export',
    description: 'Export your earnings data to CSV with detailed summaries for record-keeping and analysis.',
    selector: '[data-tour="export"]',
    position: 'left',
  },
  {
    id: 'complete',
    title: '🎉 You\'re All Set!',
    description: 'You\'re ready to start tracking your earnings. Come back anytime to view the tour again in settings.',
    position: 'center',
  },
];

export function FeatureTour() {
  const { config: themeConfig } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [highlightBox, setHighlightBox] = useState<DOMRect | null>(null);
  const step = TOUR_STEPS[currentStep];

  useEffect(() => {
    if (step.selector) {
      const element = document.querySelector(step.selector);
      if (element) {
        setIsHighlighting(true);
        const rect = element.getBoundingClientRect();
        setHighlightBox(rect);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentStep, step.selector]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('hasCompletedFeatureTour', 'true');
    window.location.reload();
  };

  const getTooltipPosition = () => {
    if (!highlightBox || !step.selector) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const padding = 20;
    const positions: Record<string, React.CSSProperties> = {
      top: {
        top: `${highlightBox.top - padding}px`,
        left: `${highlightBox.left + highlightBox.width / 2}px`,
        transform: 'translate(-50%, -100%)',
      },
      bottom: {
        top: `${highlightBox.bottom + padding}px`,
        left: `${highlightBox.left + highlightBox.width / 2}px`,
        transform: 'translate(-50%, 0)',
      },
      left: {
        top: `${highlightBox.top + highlightBox.height / 2}px`,
        left: `${highlightBox.left - padding}px`,
        transform: 'translate(-100%, -50%)',
      },
      right: {
        top: `${highlightBox.top + highlightBox.height / 2}px`,
        left: `${highlightBox.right + padding}px`,
        transform: 'translate(0, -50%)',
      },
    };

    return positions[step.position || 'bottom'];
  };

  return (
    <>
      {/* Overlay */}
      {isHighlighting && (
        <>
          <div className="fixed inset-0 bg-black/50 pointer-events-none z-40 transition-opacity duration-300" />
          {highlightBox && (
            <div
              className="fixed border-2 border-cyan-400 rounded-lg pointer-events-none z-41"
              style={{
                top: `${highlightBox.top - 4}px`,
                left: `${highlightBox.left - 4}px`,
                width: `${highlightBox.width + 8}px`,
                height: `${highlightBox.height + 8}px`,
                boxShadow: '0 0 20px rgba(34, 211, 238, 0.6)',
              }}
            />
          )}
        </>
      )}

      {/* Tooltip */}
      <div
        className={`fixed z-50 max-w-sm md:max-w-xs w-11/12 md:w-auto p-3 md:p-4 rounded-lg shadow-2xl ${
          themeConfig.name === 'dark-neon'
            ? 'bg-slate-900 border border-cyan-400 text-white'
            : themeConfig.name === 'simple-light'
            ? 'bg-white border border-blue-300 text-gray-900'
            : 'bg-black border border-white text-white'
        }`}
        style={getTooltipPosition()}
      >
        <h3 className="font-bold text-base md:text-lg mb-2">{step.title}</h3>
        <p className="text-xs md:text-sm mb-3 md:mb-4 opacity-90">{step.description}</p>

        <div className="flex items-center justify-between gap-2 mb-3 md:mb-4">
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 transition-all ${
                  idx === currentStep
                    ? 'w-6 bg-cyan-400'
                    : idx < currentStep
                    ? 'w-2 bg-cyan-400/50'
                    : 'w-2 bg-gray-500'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-gray-400">
            {currentStep + 1}/{TOUR_STEPS.length}
          </span>
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          <button
            onClick={handleSkip}
            className="px-3 py-2 md:py-1 text-xs font-bold rounded bg-gray-700 hover:bg-gray-600 transition-colors w-full md:w-auto"
          >
            Skip Tour
          </button>
          <div className="flex-1 flex gap-2">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`px-2 py-2 md:py-1 text-xs font-bold rounded transition-colors flex-1 md:flex-none ${
                currentStep === 0
                  ? 'bg-gray-700 opacity-50 cursor-not-allowed'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              className="flex-1 px-2 py-2 md:py-1 text-xs font-bold rounded bg-cyan-500 hover:bg-cyan-600 transition-colors text-black"
            >
              {currentStep === TOUR_STEPS.length - 1 ? 'Done ✓' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
