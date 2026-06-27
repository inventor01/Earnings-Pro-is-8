/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#111111',
        card: '#1a1a1a',
        border: '#262626',
        muted: '#a3a3a3',
        primary: '#a3e635',
        green: '#22c55e',
        gold: '#facc15',
        red: '#ef4444',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'neon-primary': '0 0 20px rgba(163, 230, 53, 0.4), 0 0 40px rgba(163, 230, 53, 0.2)',
        'neon-gold': '0 0 20px rgba(250, 204, 21, 0.4), 0 0 40px rgba(250, 204, 21, 0.2)',
        'neon-green': '0 0 20px rgba(34, 197, 94, 0.4), 0 0 40px rgba(34, 197, 94, 0.2)',
        'neon-red': '0 0 16px rgba(239, 68, 68, 0.35)',
      },
      animation: {
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2.5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { textShadow: '0 0 12px rgba(163, 230, 53, 0.5), 0 0 24px rgba(163, 230, 53, 0.3)' },
          '50%': { textShadow: '0 0 20px rgba(163, 230, 53, 0.8), 0 0 40px rgba(163, 230, 53, 0.5)' },
        },
      },
    },
  },
  plugins: [],
}
