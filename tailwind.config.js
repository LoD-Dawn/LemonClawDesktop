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
        // LemonClaw calm consumer palette
        page: '#F8F4EA',
        surface: '#FFFDF8',
        'surface-hover': '#F4EEDD',
        'surface-muted': '#F7F1E2',
        'surface-inset': '#EEE5D1',
        border: '#E5D9C1',
        'border-light': '#EEE6D5',
        'text-primary': '#304233',
        'text-secondary': '#687364',
        'text-muted': '#97A08F',

        // Dark mode colors
        'dark-bg': '#1A1E18',
        'dark-surface': '#242920',
        'dark-surface-hover': '#2D3428',
        'dark-surface-muted': '#1F241B',
        'dark-surface-inset': '#171C14',
        'dark-border': '#3A4336',
        'dark-border-light': '#2B3328',
        'dark-text': '#F5F0E3',
        'dark-text-secondary': '#D4D7C8',
        'dark-text-muted': '#9DA693',

        // Primary
        primary: {
          DEFAULT: '#6E8B54',
          light: '#84A566',
          lighter: '#B8CF8E',
          muted: 'rgba(110, 139, 84, 0.14)',
        },
        secondary: {
          DEFAULT: '#D8BF68',
          dark: '#E8D48E'
        }
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(73, 60, 32, 0.06)',
        card: '0 10px 26px rgba(139, 121, 78, 0.10), 0 2px 8px rgba(139, 121, 78, 0.06)',
        elevated: '0 18px 50px rgba(139, 121, 78, 0.14), 0 4px 16px rgba(139, 121, 78, 0.08)',
        modal: '0 22px 60px rgba(69, 57, 30, 0.18), 0 4px 16px rgba(69, 57, 30, 0.08)',
        popover: '0 18px 44px rgba(69, 57, 30, 0.16), 0 4px 12px rgba(69, 57, 30, 0.08)',
        focus: '0 18px 42px rgba(110, 139, 84, 0.18)',
        'focus-dark': '0 18px 42px rgba(184, 207, 142, 0.18)',
        'card-hover': '0 14px 34px rgba(139, 121, 78, 0.16)',
        'card-hover-dark': '0 14px 34px rgba(17, 22, 16, 0.34)',
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
            color: '#304233',
            a: {
              color: '#6E8B54',
              '&:hover': {
                color: '#84A566',
              },
            },
            code: {
              color: '#304233',
              backgroundColor: 'rgba(238, 229, 209, 0.65)',
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
              backgroundColor: '#F6F0E1',
              color: '#304233',
              padding: '1em',
              borderRadius: '0.75rem',
              overflowX: 'auto',
            },
            blockquote: {
              borderLeftColor: '#6E8B54',
              color: '#687364',
            },
            h1: {
              color: '#304233',
            },
            h2: {
              color: '#304233',
            },
            h3: {
              color: '#304233',
            },
            h4: {
              color: '#304233',
            },
            strong: {
              color: '#304233',
            },
          },
        },
        dark: {
          css: {
            color: '#F5F0E3',
            a: {
              color: '#B8CF8E',
              '&:hover': {
                color: '#D8BF68',
              },
            },
            code: {
              color: '#F5F0E3',
              backgroundColor: 'rgba(58, 67, 54, 0.72)',
              padding: '0.2em 0.4em',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            pre: {
              backgroundColor: '#1B2118',
              color: '#F5F0E3',
              padding: '1em',
              borderRadius: '0.75rem',
              overflowX: 'auto',
            },
            blockquote: {
              borderLeftColor: '#B8CF8E',
              color: '#D4D7C8',
            },
            h1: {
              color: '#F5F0E3',
            },
            h2: {
              color: '#F5F0E3',
            },
            h3: {
              color: '#F5F0E3',
            },
            h4: {
              color: '#F5F0E3',
            },
            strong: {
              color: '#F5F0E3',
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
