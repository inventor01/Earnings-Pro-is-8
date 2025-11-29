import { useTheme } from '../lib/themeContext';

interface ScrollToTopButtonProps {
  isFormOpen?: boolean;
}

export function ScrollToTopButton({ isFormOpen = false }: ScrollToTopButtonProps) {
  const { theme } = useTheme();
  const isDarkTheme = theme === 'ninja-dark';

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
          className={`fixed right-3 md:right-5 bottom-20 md:bottom-44 z-50 p-2 md:p-3 rounded-full shadow-lg transition-all active:scale-95 active:opacity-100 hover:opacity-100 opacity-40 md:hover:scale-110 touch-action-manipulation ${
            isDarkTheme
              ? 'bg-gradient-to-br from-cyan-400 to-cyan-500 text-slate-900 border-2 border-cyan-300'
              : 'bg-gradient-to-br from-yellow-300 to-yellow-400 text-slate-900 border-2 border-yellow-200'
          }`}
          aria-label="Scroll to top"
          title="Scroll to top"
          style={{ touchAction: 'manipulation' }}
        >
          <svg className="w-5 md:w-6 h-5 md:h-6 font-bold" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 16l-4-4m0 0l4-4m-4 4h18" transform="rotate(90 12 12)" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} />
          </svg>
        </button>
    </>
  );
}
