/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#EEEDF5',
          100: '#D5D3E5',
          200: '#AEAACF',
          300: '#8680B9',
          400: '#5F57A3',
          500: '#3D3580',
          600: '#2E285F',
          700: '#262050',
          800: '#1E1A34',
          900: '#131024',
          950: '#0A0814',
        },
        brand: {
          DEFAULT: '#1E1A34',
          light: '#2E285F',
          dark: '#131024',
        },
        accent: {
          DEFAULT: '#00A499',
          foreground: '#ffffff',
          light: '#1AC5BA',
          dark: '#008C83',
          50: '#E6F7F6',
          100: '#B3EBE7',
          200: '#80DED8',
          300: '#4DD2C9',
          400: '#1AC5BA',
          500: '#00A499',
          600: '#008C83',
          700: '#00736C',
          800: '#005B55',
          900: '#00423E',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        display: ['Montserrat', 'sans-serif'],
        sans: ['Montserrat', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
