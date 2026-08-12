/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#EEF2F9',
          100: '#D5DFF0',
          200: '#ABBFE1',
          300: '#809FD2',
          400: '#567FC3',
          500: '#2B5FB4',
          600: '#1E4A8F',
          700: '#163769',
          800: '#0F2648',
          900: '#071227',
          950: '#040A16',
        },
        brand: {
          DEFAULT: '#1B3A6B',
          light: '#2352A0',
          dark: '#0F2248',
        },
        gold: '#C49A2A',
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
