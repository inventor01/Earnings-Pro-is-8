import { useTheme } from '../lib/themeContext';

export function ScrollToTopButton() {
  const { theme } = useTheme();
  const isDarkTheme = theme === 'dark-neon';

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <>
        <button
          onClick={scrollToTop}
          className={`fixed right-3 md:right-5 top-1/2 -translate-y-1/2 z-50 p-3 md:p-4 rounded-full shadow-2xl transition-all active:scale-95 animate-bounce md:hover:scale-125 touch-action-manipulation ${
            isDarkTheme
              ? 'bg-gradient-to-br from-cyan-400 to-cyan-500 md:hover:from-cyan-300 md:hover:to-cyan-400 text-slate-900 border-2 border-cyan-300'
              : 'bg-gradient-to-br from-yellow-300 to-yellow-400 md:hover:from-yellow-200 md:hover:to-yellow-300 text-slate-900 border-2 border-yellow-200'
          }`}
          aria-label="Scroll to top"
          title="Scroll to top"
          style={{ touchAction: 'manipulation' }}
        >
          <svg className="w-6 md:w-7 h-6 md:h-7 font-bold" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 16l-4-4m0 0l4-4m-4 4h18" transform="rotate(90 12 12)" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} />
          </svg>
        </button>
    </>
  );
}
