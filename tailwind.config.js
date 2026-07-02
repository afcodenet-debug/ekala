/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        olive: {
          25: '#fafaf8',
          50: '#f7f7f5',
          100: '#e8e8e3',
          200: '#d1d1c7',
          300: '#b3b3a3',
          400: '#8f8f7f',
          500: '#6b6b5b',
          600: '#55554b',
          700: '#40403a',
          800: '#2a2a25',
          900: '#1a1a15',
        },
        gold: {
          400: '#d4af37',
          500: '#b8860b',
          600: '#9a720a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
