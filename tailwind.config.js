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
        // Ink Blue Enterprise color palette
        page: '#F5F5F7',              // Light page bg
        surface: '#FFFFFF',          // Cards, inputs
        'surface-hover': '#EBEBED',     // Hover state
        'surface-muted': '#F3F4F6',     // Subtle area distinction
        'surface-inset': '#EBEDF0',     // Inset areas
        border: '#E8E8EB',           // Default border
        'border-light': '#EBEDF0',      // Subtle dividers
        'text-primary': '#1F2329',             // Primary text
        'text-secondary': '#646A73',    // Secondary text
        'text-muted': '#8F959E',        // Muted text

        // Dark mode colors
        'dark-bg': '#0F1117',           // Dark background
        'dark-surface': '#1A1D27',      // Dark cards
        'dark-surface-hover': '#242830', // Dark hover
        'dark-surface-muted': '#151820', // Subtle dark area
        'dark-surface-inset': '#0C0E14', // Dark inset areas
        'dark-border': '#2A2E38',       // Dark borders
        'dark-border-light': '#1F232B',  // Subtle dark dividers
        'dark-text': '#E4E5E9',         // Dark primary text
        'dark-text-secondary': '#9CA3AF', // Dark secondary text
        'dark-text-muted': '#8B8FA3',   // Dark muted text

        // Primary (Ink Blue)
        primary: {
          DEFAULT: '#0D2847', // Deep Ink Blue
          light: '#134E6F',   // Hover in light
          lighter: '#1E5F7A', // Focus ring
          muted: 'rgba(13, 40, 71, 0.10)',
        },
        secondary: {
          DEFAULT: '#646A73',
          dark: '#9CA3AF'
        }
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0,0,0,0.05)',
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        elevated: '0 4px 12px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.04)',
        modal: '0 8px 30px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)',
        popover: '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.05)',
        focus: '0 8px 32px rgba(13, 40, 71, 0.18)',
        'focus-dark': '0 8px 32px rgba(91, 163, 224, 0.25)',
        'card-hover': '0 2px 12px rgba(13, 40, 71, 0.12)',
        'card-hover-dark': '0 2px 12px rgba(91, 163, 224, 0.2)',
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
            color: '#1F2329',
            a: {
              color: '#0D2847',
              '&:hover': {
                color: '#134E6F',
              },
            },
            code: {
              color: '#1F2329',
              backgroundColor: 'rgba(235, 237, 240, 0.5)',
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
              backgroundColor: '#F5F5F7',
              color: '#1F2329',
              padding: '1em',
              borderRadius: '0.75rem',
              overflowX: 'auto',
            },
            blockquote: {
              borderLeftColor: '#0D2847',
              color: '#646A73',
            },
            h1: {
              color: '#1F2329',
            },
            h2: {
              color: '#1F2329',
            },
            h3: {
              color: '#1F2329',
            },
            h4: {
              color: '#1F2329',
            },
            strong: {
              color: '#1F2329',
            },
          },
        },
        dark: {
          css: {
            color: '#E4E5E9',
            a: {
              color: '#60A5FA',
              '&:hover': {
                color: '#93BBFD',
              },
            },
            code: {
              color: '#E4E5E9',
              backgroundColor: 'rgba(42, 46, 56, 0.5)',
              padding: '0.2em 0.4em',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            pre: {
              backgroundColor: '#1A1D27',
              color: '#E4E5E9',
              padding: '1em',
              borderRadius: '0.75rem',
              overflowX: 'auto',
            },
            blockquote: {
              borderLeftColor: '#3B82F6',
              color: '#8B8FA3',
            },
            h1: {
              color: '#E4E5E9',
            },
            h2: {
              color: '#E4E5E9',
            },
            h3: {
              color: '#E4E5E9',
            },
            h4: {
              color: '#E4E5E9',
            },
            strong: {
              color: '#E4E5E9',
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
