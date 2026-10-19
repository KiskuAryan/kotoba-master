/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nobunaga: {
          red: '#D8003A',
          crimson: '#B8002F',
          cream: '#F3EBDD',
          parchment: '#E9DEC9',
          dark: '#111827',
          charcoal: '#1F2937'
        },
        notebook: {
          paper: '#FAF7F2',
          grid: '#E2DBD0',
          blue: '#3B82F6',
          pink: '#F43F5E',
          yellow: '#FEF08A'
        },
        star: {
          1: '#94A3B8',
          2: '#F59E0B',
          3: '#38BDF8',
          4: '#818CF8',
          5: '#10B981'
        }
      },
      fontFamily: {
        display: ['Anton', 'Dela Gothic One', 'sans-serif'],
        kanji: ['Noto Serif JP', 'serif'],
        sans: ['Inter', 'DM Sans', 'sans-serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        }
      }
    },
  },
  plugins: [],
}
