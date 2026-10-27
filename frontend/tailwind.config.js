/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        scada: {
          bg: '#0A0C0E',
          card: '#121519',
          cardHover: '#181D22',
          border: '#1F242B',
          borderLight: '#2D343E',
          muted: '#6B7280',
          subtext: '#9CA3AF',
          text: '#F3F4F6',
          emerald: '#10B981',
          emeraldGlow: 'rgba(16, 185, 129, 0.15)',
          amber: '#F59E0B',
          red: '#EF4444',
          cyan: '#06B6D4',
          blue: '#3B82F6',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.3)',
        'glow-red': '0 0 25px -5px rgba(239, 68, 68, 0.35)',
        'glow-amber': '0 0 25px -5px rgba(245, 158, 11, 0.3)',
        'scada-card': '0 4px 20px -2px rgba(0, 0, 0, 0.65)',
      }
    },
  },
  plugins: [],
}
