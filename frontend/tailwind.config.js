/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff7f3',
          100: '#ffede6',
          200: '#ffd9cc',
          300: '#ffbfa3',
          400: '#ff9c6b',
          500: '#FF6B35',
          600: '#e55a2b',
          700: '#cc4a21',
          800: '#b33c1a',
          900: '#992f13',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#2C3E50',
          900: '#1e293b',
        },
        accent: {
          50: '#fff8f6',
          100: '#ffede8',
          200: '#ffd9d0',
          300: '#ffbaa8',
          400: '#ff9073',
          500: '#FF8C69',
          600: '#e6705a',
          700: '#cc5a47',
          800: '#b34738',
          900: '#99372a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'large': '0 10px 60px -10px rgba(0, 0, 0, 0.2), 0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}

