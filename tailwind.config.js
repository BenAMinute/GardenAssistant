/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        soil: {
          50: '#faf6f0',
          100: '#f3ebe0',
          200: '#e5d4be',
          300: '#d4b895',
          400: '#c1986b',
          500: '#b1804e',
          600: '#9c6940',
          700: '#825336',
          800: '#6b4531',
          900: '#583a2b',
        }
      }
    },
  },
  plugins: [],
}
