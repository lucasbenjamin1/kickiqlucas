/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef2f3',
          100: '#fde6e9',
          200: '#fbd0d7',
          300: '#f7a9b5',
          400: '#f2798d',
          500: '#e84a68',
          600: '#d42a51',
          700: '#c41e3a',
          800: '#9a1c37',
          900: '#841c34',
          950: '#4a0a18',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};
