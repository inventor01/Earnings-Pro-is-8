import { useState, useEffect } from 'react';
import { useTheme } from '../lib/themeContext';

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const { theme } = useTheme();
  const isDarkTheme = theme === 'dark-neon';

  const toggleVisibility = () => {
    if (window.scrollY > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    window.addEventListener('scroll', toggleVisibility);
    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  return (
    <>
      {isVisible && (
        <button
          onClick={scrollToTop}
          className={`fixed right-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full shadow-lg transition-all hover:scale-110 active:scale-95 ${
            isDarkTheme
              ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-900'
              : 'bg-gradient-to-br from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-slate-900'
          }`}
          aria-label="Scroll to top"
        >
          <svg className="w-5 h-5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16l-4-4m0 0l4-4m-4 4h18" transform="rotate(90 12 12)" />
          </svg>
        </button>
      )}
    </>
  );
}
