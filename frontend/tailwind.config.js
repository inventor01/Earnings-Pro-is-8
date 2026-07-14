export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand accent = the Add Entry button yellow (#facc15).
        // yellow-400 and yellow-500 both resolve to the exact brand yellow so
        // every accent (buttons, borders, glows, text) matches 1:1.
        // 300 stays lighter and 600 darker purely for hover/pressed feedback.
        yellow: {
          300: '#fde047',
          400: '#facc15',
          500: '#facc15',
          600: '#eab308',
        },
        // amber shades appear only inside gradients paired with the brand
        // yellow — keep them in the same hue family so gradients stay on-brand.
        amber: {
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
        },
        brand: '#facc15',
      },
      boxShadow: {
        'neon-brand': '0 0 20px rgba(250, 204, 21, 0.4), 0 0 40px rgba(250, 204, 21, 0.2)',
      },
    },
  },
  plugins: [],
}
