/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        neon: {
          green: '#22c55e',
          lime: '#84cc16',
          yellow: '#facc15',
          cyan: '#22d3ee',
          red: '#ef4444',
          purple: '#a855f7',
          orange: '#f97316',
          blue: '#3b82f6',
        },
        dash: {
          bg: '#0a0a0f',
          surface: '#111118',
          card: '#16161f',
          border: '#1e1e2e',
        },
      },
    },
  },
  plugins: [],
};
