import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Visa TAP Brand Colors
        visa: {
          blue: '#1A1F71',
          'blue-light': '#2A3080',
          'blue-dark': '#0D1040',
          gold: '#F7B600',
          'gold-light': '#FFD54F',
        },
        // Status Colors
        verified: {
          DEFAULT: '#00A36C',
          light: '#E8F5E9',
        },
        pending: {
          DEFAULT: '#FF9800',
          light: '#FFF3E0',
        },
        failed: {
          DEFAULT: '#DC2626',
          light: '#FEE2E2',
        },
        // UI Colors
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F8FAFC',
          tertiary: '#F1F5F9',
        },
        border: {
          DEFAULT: '#E2E8F0',
          dark: '#CBD5E1',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'glow-gold': '0 0 20px rgba(247, 182, 0, 0.3)',
        'glow-verified': '0 0 20px rgba(0, 163, 108, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flow': 'flow 2s ease-in-out infinite',
      },
      keyframes: {
        flow: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
