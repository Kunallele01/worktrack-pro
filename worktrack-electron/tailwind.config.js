/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,jsx,html}', './src/renderer/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      colors: {
        accent: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bdd0ff',
          300: '#93b8ff',
          400: '#6b99fa',
          500: '#4f86f7',
          600: '#3b6de8',
          700: '#2a5ad0',
          800: '#1e47b0',
          900: '#17388a',
        },
        surface: {
          DEFAULT: '#111827',
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          700: '#1f2937',
          800: '#111827',
          900: '#0a0e1a',
          950: '#060810',
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.4 },
        },
        'slide-in': {
          '0%': { transform: 'translateY(-8px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
