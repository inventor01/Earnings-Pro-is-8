import { useState, useEffect } from 'react';
import { useTheme } from '../lib/themeContext';

interface TourStep {
  id: string;
  title: string;
  description: string;
  selector?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'hero',
    title: '🚗 Welcome to EARNINGS PRO',
    description: 'Track your delivery earnings across all gig platforms with real-time insights and analytics.',
  },
  {
    id: 'periods',
    title: '📅 Time Period Filtering',
    description: 'Switch between different time periods (Today, Yesterday, This Week, etc.) to analyze your earnings.',
    selector: '[data-tour="periods"]',
  },
  {
    id: 'search',
    title: '🔍 Transaction Search',
    description: 'Quickly search and filter your transactions by note, platform, category, type, or amount.',
    selector: '[data-tour="search"]',
  },
  {
    id: 'performance',
    title: '📊 Performance Overview',
    description: 'View your key metrics: Revenue, Expenses, Profit, Miles, Orders, and Average Order Value.',
    selector: '[data-tour="performance"]',
  },
  {
    id: 'kpis',
    title: '💡 Advanced Metrics',
    description: 'Check $/Mile, $/Hour, and other efficiency metrics to optimize your earnings strategy.',
    selector: '[data-tour="kpis"]',
  },
  {
    id: 'calculator',
    title: '🧮 Calculator Input',
    description: 'Quickly add entries using the calculator interface. Choose Add or Subtract mode for flexibility.',
    selector: '[data-tour="calculator"]',
  },
  {
    id: 'entries',
    title: '📝 Transaction History',
    description: 'View, edit, and manage all your transactions with bulk delete and selection options.',
    selector: '[data-tour="entries"]',
  },
  {
    id: 'settings',
    title: '⚙️ Settings & Customization',
    description: 'Configure profit goals, choose your theme, connect platforms, and manage preferences.',
    selector: '[data-tour="settings"]',
  },
  {
    id: 'export',
    title: '📥 Data Export',
    description: 'Export your earnings data to CSV with detailed summaries for record-keeping and analysis.',
    selector: '[data-tour="export"]',
  },
  {
    id: 'complete',
    title: '🎉 You\'re All Set!',
    description: 'You\'re ready to start tracking your earnings. Come back anytime to view the tour again in settings.',
  },
];

export function FeatureTour() {
  const { config: themeConfig } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [highlightBox, setHighlightBox] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const step = TOUR_STEPS[currentStep];

  useEffect(() => {
    // Dispatch event to expand calculator when reaching that step
    if (step.id === 'calculator') {
      window.dispatchEvent(new CustomEvent('tour-calculator-step'));
    }
    
    if (step.selector) {
      const element = document.querySelector(step.selector);
      if (element) {
        setIsHighlighting(true);
        
        // Special handling for different tour steps
        if (step.id === 'kpis') {
          // For KPI container, highlight only the first card on mobile
          const container = element.querySelector('.flex') as HTMLElement;
          const firstCard = element.querySelector('[class*="flex-shrink"]') as HTMLElement;
          
          if (container && firstCard) {
            // Scroll the first card into view at the top
            container.scrollLeft = 0;
            
            // Scroll the container to top of viewport for better space
            element.scrollIntoView({ behavior: 'auto', block: 'start' });
            
            // Small delay to ensure scroll completes before getting rect
            setTimeout(() => {
              const rect = firstCard.getBoundingClientRect();
              setHighlightBox(rect);
              calculateTooltipPosition(rect);
            }, 50);
          } else {
            const rect = element.getBoundingClientRect();
            setHighlightBox(rect);
            element.scrollIntoView({ behavior: 'auto', block: 'start' });
            calculateTooltipPosition(rect);
          }
        } else if (step.id === 'periods') {
          // For periods, highlight the button container
          const buttonContainer = element.querySelector('.flex') as HTMLElement;
          if (buttonContainer) {
            element.scrollIntoView({ behavior: 'auto', block: 'start' });
            const rect = buttonContainer.getBoundingClientRect();
            setHighlightBox(rect);
            calculateTooltipPosition(rect);
          } else {
            const rect = element.getBoundingClientRect();
            setHighlightBox(rect);
            element.scrollIntoView({ behavior: 'auto', block: 'start' });
            calculateTooltipPosition(rect);
          }
        } else if (step.id === 'search') {
          // For search, highlight the input container
          const inputContainer = element.querySelector('div[class*="flex"]') as HTMLElement;
          if (inputContainer) {
            element.scrollIntoView({ behavior: 'auto', block: 'start' });
            const rect = inputContainer.getBoundingClientRect();
            setHighlightBox(rect);
            calculateTooltipPosition(rect);
          } else {
            const rect = element.getBoundingClientRect();
            setHighlightBox(rect);
            element.scrollIntoView({ behavior: 'auto', block: 'start' });
            calculateTooltipPosition(rect);
          }
        } else if (step.id === 'settings' || step.id === 'export') {
          // For settings/export buttons at top, scroll to top and highlight
          window.scrollTo({ top: 0, behavior: 'auto' });
          // Add delay to ensure scroll completes before calculating position
          setTimeout(() => {
            const rect = element.getBoundingClientRect();
            setHighlightBox(rect);
            
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const isMobile = viewportWidth < 768;
            
            if (isMobile) {
              // On mobile, position tooltip at top-center for guaranteed visibility
              const centerX = Math.max(8, (viewportWidth - 280) / 2);
              setTooltipStyle({
                top: '16px',
                left: `${centerX}px`,
                position: 'fixed',
                maxHeight: `${viewportHeight - 70 - 50}px`,
                overflow: 'auto',
              });
            } else {
              calculateTooltipPosition(rect);
            }
          }, 50);
          return;
        } else {
          const rect = element.getBoundingClientRect();
          setHighlightBox(rect);
          element.scrollIntoView({ behavior: 'auto', block: 'start' });
          calculateTooltipPosition(rect);
        }
      }
    } else {
      // For steps without selectors (like completion), show centered
      setIsHighlighting(false);
      window.scrollTo({ top: 0, behavior: 'auto' });
      const centerX = (window.innerWidth - 320) / 2;
      const centerY = (window.innerHeight - 240) / 2;
      setTooltipStyle({ 
        top: `${Math.max(16, centerY)}px`, 
        left: `${Math.max(16, centerX)}px`, 
        position: 'fixed',
      });
    }
  }, [currentStep, step.selector]);

  const calculateTooltipPosition = (rect: DOMRect) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = 320; // Approximate width
    const tooltipHeight = 240; // Approximate height
    const margin = 16; // Margin from screen edges
    const spacing = 16; // Spacing from highlighted element

    // On mobile, always position below or above the element
    const isMobile = viewportWidth < 768;

    if (isMobile) {
      // Mobile: position below or above the element, centered horizontally
      const centerX = Math.max(margin, Math.min(viewportWidth - margin - tooltipWidth, viewportWidth / 2 - tooltipWidth / 2));
      const buttonHeight = 50; // Approximate height for buttons at bottom
      const topElementThreshold = 80; // If element is near top of screen, use below positioning
      
      // If element is at the top of screen (like settings/export buttons), place below it
      if (rect.top < topElementThreshold) {
        setTooltipStyle({
          top: `${rect.bottom + spacing}px`,
          left: `${centerX}px`,
          position: 'fixed',
          maxHeight: `${viewportHeight - rect.bottom - spacing - margin - buttonHeight}px`,
          overflow: 'auto',
        });
      }
      // Try to place below first with extra space for buttons
      else if (rect.bottom + spacing + tooltipHeight + buttonHeight < viewportHeight - margin) {
        setTooltipStyle({
          top: `${rect.bottom + spacing}px`,
          left: `${centerX}px`,
          position: 'fixed',
          maxHeight: `${viewportHeight - rect.bottom - spacing - margin - buttonHeight}px`,
          overflow: 'auto',
        });
      } else if (rect.top - spacing - tooltipHeight - buttonHeight > margin) {
        // Place above if below doesn't fit
        setTooltipStyle({
          top: `${rect.top - spacing - tooltipHeight}px`,
          left: `${centerX}px`,
          position: 'fixed',
          maxHeight: `${rect.top - spacing - margin - 20}px`,
          overflow: 'auto',
        });
      } else {
        // Fallback: position below even if tight, to show tooltip
        setTooltipStyle({
          top: `${Math.min(rect.bottom + spacing, viewportHeight - tooltipHeight - margin)}px`,
          left: `${centerX}px`,
          position: 'fixed',
          maxHeight: `${viewportHeight - margin * 2 - buttonHeight}px`,
          overflow: 'auto',
        });
      }
    } else {
      // Desktop: try to position to the right
      let top = rect.top + rect.height / 2 - tooltipHeight / 2;
      let left = rect.right + spacing;

      // Adjust if goes off screen
      if (left + tooltipWidth > viewportWidth - margin) {
        left = rect.left - spacing - tooltipWidth;
      }
      if (left < margin) {
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
      }
      if (top + tooltipHeight > viewportHeight - margin) {
        top = viewportHeight - margin - tooltipHeight;
      }
      if (top < margin) {
        top = margin;
      }

      setTooltipStyle({
        top: `${top}px`,
        left: `${left}px`,
        position: 'fixed',
      });
    }
  };

  const handleNext = () => {
    // Close calculator when leaving calculator step
    if (TOUR_STEPS[currentStep].id === 'calculator') {
      window.dispatchEvent(new CustomEvent('tour-calculator-close'));
    }
    
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    // Close calculator when leaving calculator step
    if (TOUR_STEPS[currentStep].id === 'calculator') {
      window.dispatchEvent(new CustomEvent('tour-calculator-close'));
    }
    
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('hasCompletedFeatureTour', 'true');
    window.location.reload();
  };

  return (
    <>
      {/* Overlay */}
      {isHighlighting && (
        <>
          <div className="fixed inset-0 bg-black/50 pointer-events-none z-40" />
          {highlightBox && (
            <>
              {/* Inner highlight - bright glow inside the element */}
              <div
                className="fixed border-2 border-cyan-400 rounded-lg pointer-events-none z-41"
                style={{
                  top: `${highlightBox.top - 4}px`,
                  left: `${highlightBox.left - 4}px`,
                  width: `${highlightBox.width + 8}px`,
                  height: `${highlightBox.height + 8}px`,
                  boxShadow: `
                    0 0 15px rgba(34, 211, 238, 0.8),
                    0 0 30px rgba(34, 211, 238, 0.6),
                    0 0 45px rgba(6, 182, 212, 0.4),
                    inset 0 0 15px rgba(34, 211, 238, 0.2)
                  `,
                  background: 'rgba(34, 211, 238, 0.05)',
                }}
              />
              {/* Bright spotlight effect under the highlighted element */}
              <div
                className="fixed rounded-lg pointer-events-none z-40"
                style={{
                  top: `${highlightBox.top - 8}px`,
                  left: `${highlightBox.left - 8}px`,
                  width: `${highlightBox.width + 16}px`,
                  height: `${highlightBox.height + 16}px`,
                  boxShadow: `0 0 60px rgba(34, 211, 238, 0.3), 0 0 100px rgba(6, 182, 212, 0.15)`,
                }}
              />
            </>
          )}
        </>
      )}

      {/* Tooltip - Always mobile-optimized */}
      <div
        className={`fixed z-50 rounded-lg shadow-2xl ${
          themeConfig.name === 'dark-neon'
            ? 'bg-slate-900 border border-cyan-400 text-white'
            : themeConfig.name === 'simple-light'
            ? 'bg-white border border-blue-300 text-gray-900'
            : 'bg-black border border-white text-white'
        }`}
        style={{
          ...tooltipStyle,
          width: window.innerWidth < 360 ? 'calc(100vw - 1rem)' : 
                 window.innerWidth < 480 ? 'calc(100vw - 2rem)' : 
                 'auto',
          maxWidth: window.innerWidth < 480 ? '280px' : '320px',
          padding: window.innerWidth < 360 ? '0.625rem' : window.innerWidth < 480 ? '0.75rem' : '1rem',
        }}
      >
        <h3 className={`font-bold mb-1 line-clamp-2 ${
          window.innerWidth < 360 ? 'text-xs' : 
          window.innerWidth < 480 ? 'text-sm' : 
          'md:text-lg text-sm'
        }`}>{step.title}</h3>
        <p className={`mb-2 opacity-90 line-clamp-3 ${
          window.innerWidth < 360 ? 'text-[10px]' : 
          window.innerWidth < 480 ? 'text-xs' : 
          'md:text-sm text-xs'
        }`}>{step.description}</p>

        <div className="flex items-center justify-between gap-1 mb-2">
          <div className="flex gap-0.5 flex-wrap">
            {TOUR_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-0.5 transition-all ${
                  idx === currentStep
                    ? 'w-2 md:w-6 bg-cyan-400'
                    : idx < currentStep
                    ? 'w-1 md:w-2 bg-cyan-400/50'
                    : 'w-1 md:w-2 bg-gray-500'
                }`}
              />
            ))}
          </div>
          <span className={`font-semibold text-gray-400 whitespace-nowrap ml-1 ${
            window.innerWidth < 360 ? 'text-[8px]' : 
            window.innerWidth < 480 ? 'text-[9px]' : 
            'text-xs'
          }`}>
            {currentStep + 1}/{TOUR_STEPS.length}
          </span>
        </div>

        <div className={`flex flex-col md:flex-row gap-1 w-full ${
          window.innerWidth < 480 ? 'gap-0.5' : 'md:gap-2'
        }`}>
          <button
            onClick={handleSkip}
            className={`rounded bg-slate-700 hover:bg-slate-600 transition-colors w-full md:w-auto whitespace-nowrap text-gray-100 font-bold ${
              window.innerWidth < 360 ? 'px-1.5 py-1 text-[8px]' : 
              window.innerWidth < 480 ? 'px-2 py-1 text-[9px]' : 
              'md:py-1 px-3 text-xs md:text-sm'
            }`}
          >
            Skip
          </button>
          <div className="flex gap-1 w-full md:w-auto flex-1 md:gap-2">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`rounded transition-colors flex-1 md:flex-none whitespace-nowrap font-bold ${
                currentStep === 0
                  ? 'bg-slate-700 opacity-40 cursor-not-allowed text-gray-400'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              } ${
                window.innerWidth < 360 ? 'px-1 py-1 text-[8px]' : 
                window.innerWidth < 480 ? 'px-1.5 py-1 text-[9px]' : 
                'md:py-1 px-2 md:px-3 text-xs md:text-sm'
              }`}
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              className={`flex-1 md:flex-none rounded bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 transition-all text-black whitespace-nowrap shadow-lg hover:shadow-cyan-500/50 font-bold ${
                window.innerWidth < 360 ? 'px-1 py-1 text-[8px]' : 
                window.innerWidth < 480 ? 'px-1.5 py-1 text-[9px]' : 
                'md:py-1 px-2 md:px-3 text-xs md:text-sm'
              }`}
            >
              {currentStep === TOUR_STEPS.length - 1 ? 'Done ✓' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
