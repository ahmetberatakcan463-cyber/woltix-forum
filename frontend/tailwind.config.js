/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#080808',
          secondary: '#101010',
          tertiary: '#161616',
          card: '#111111',
        },
        border: {
          DEFAULT: '#1e1e1e',
          hover: '#2a2a2a',
        },
        accent: {
          green: '#00ff41',
          purple: '#a855f7',
          red: '#ff4444',
          yellow: '#f59e0b',
          cyan: '#06b6d4',
        },
        text: {
          primary: '#e0e0e0',
          secondary: '#888888',
          muted: '#555555',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-green': 'pulseGreen 2s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        pulseGreen: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
