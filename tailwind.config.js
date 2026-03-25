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
        // Codex-inspired neutral desktop palette
        page: '#F5F5F2',
        surface: '#FCFCFA',
        'surface-hover': '#F1F1ED',
        'surface-muted': '#ECECE7',
        'surface-inset': '#E6E6E0',
        border: '#E2E2DB',
        'border-light': '#ECECE6',
        'text-primary': '#1F1F1B',
        'text-secondary': '#6E6E65',
        'text-muted': '#9A9A8F',

        // Dark mode colors
        'dark-bg': '#0F1723',
        'dark-surface': '#16202C',
        'dark-surface-hover': '#1D2936',
        'dark-surface-muted': '#121B26',
        'dark-surface-inset': '#0C141E',
        'dark-border': '#2E3C4D',
        'dark-border-light': '#223042',
        'dark-text': '#E7EEF7',
        'dark-text-secondary': '#B5C0CE',
        'dark-text-muted': '#8190A2',

        // Primary
        primary: {
          DEFAULT: '#334155',
          light: '#475569',
          lighter: '#C5D2E2',
          muted: 'rgba(51, 65, 85, 0.14)',
        },
        secondary: {
          DEFAULT: '#7DB4CF',
          dark: '#9CCBE2'
        }
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(15, 23, 42, 0.03)',
        card: '0 10px 24px rgba(15, 23, 42, 0.05), 0 2px 6px rgba(15, 23, 42, 0.03)',
        elevated: '0 18px 40px rgba(15, 23, 42, 0.08), 0 4px 14px rgba(15, 23, 42, 0.04)',
        modal: '0 24px 60px rgba(15, 23, 42, 0.12), 0 6px 18px rgba(15, 23, 42, 0.05)',
        popover: '0 16px 36px rgba(15, 23, 42, 0.10), 0 4px 10px rgba(15, 23, 42, 0.04)',
        focus: '0 14px 32px rgba(51, 65, 85, 0.12)',
        'focus-dark': '0 18px 42px rgba(125, 180, 207, 0.18)',
        'card-hover': '0 14px 32px rgba(15, 23, 42, 0.08)',
        'card-hover-dark': '0 18px 42px rgba(8, 15, 24, 0.34)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.25s ease-out',
        'fade-in-down': 'fade-in-down 0.2s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        shimmer: 'shimmer 1.5s infinite',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#1F2937',
            a: {
              color: '#334155',
              '&:hover': {
                color: '#475569',
              },
            },
            code: {
              color: '#1F2937',
              backgroundColor: 'rgba(230, 237, 245, 0.82)',
              padding: '0.2em 0.4em',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            pre: {
              backgroundColor: '#F3F7FB',
              color: '#1F2937',
              padding: '1em',
              borderRadius: '0.75rem',
              overflowX: 'auto',
            },
            blockquote: {
              borderLeftColor: '#334155',
              color: '#64748B',
            },
            h1: {
              color: '#1F2937',
            },
            h2: {
              color: '#1F2937',
            },
            h3: {
              color: '#1F2937',
            },
            h4: {
              color: '#1F2937',
            },
            strong: {
              color: '#1F2937',
            },
          },
        },
        dark: {
          css: {
            color: '#E7EEF7',
            a: {
              color: '#C5D2E2',
              '&:hover': {
                color: '#9CCBE2',
              },
            },
            code: {
              color: '#E7EEF7',
              backgroundColor: 'rgba(34, 48, 66, 0.78)',
              padding: '0.2em 0.4em',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            pre: {
              backgroundColor: '#111B27',
              color: '#E7EEF7',
              padding: '1em',
              borderRadius: '0.75rem',
              overflowX: 'auto',
            },
            blockquote: {
              borderLeftColor: '#9CCBE2',
              color: '#B5C0CE',
            },
            h1: {
              color: '#E7EEF7',
            },
            h2: {
              color: '#E7EEF7',
            },
            h3: {
              color: '#E7EEF7',
            },
            h4: {
              color: '#E7EEF7',
            },
            strong: {
              color: '#E7EEF7',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
