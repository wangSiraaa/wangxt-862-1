/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        'commander': {
          bg: '#0b1a2b',
          panel: '#132743',
          accent: '#3b82f6',
          border: '#1e3a5f'
        },
        'heat-high': '#ff4d4f',
        'heat-mid': '#faad14',
        'heat-low': '#52c41a',
        'heat-normal': '#1890ff'
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate'
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.9)' }
        }
      }
    }
  },
  plugins: []
}
