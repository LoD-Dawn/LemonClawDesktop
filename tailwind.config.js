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
        // Ink Blue Enterprise color palette (Clean white style)
        page: '#FFFFFF',              // Pure white background
        surface: '#FFFFFF',           // Pure white cards
        'surface-hover': '#F3F4F6',   // Clean gray hover (gray-100)
        'surface-muted': '#F9FAFB',   // Very subtle gray area (gray-50)
        'surface-inset': '#F3F4F6',   // Inset areas
        border: '#E5E7EB',            // Lighter border (gray-200)
        'border-light': '#F3F4F6',    // Very subtle dividers
        'text-primary': '#111827',    // Strong almost black (gray-900)
        'text-secondary': '#4B5563',  // Dark gray for secondary (gray-600)
        'text-muted': '#9CA3AF',      // Muted text (gray-400)

        // Dark mode colors
        'dark-bg': '#0F1117',           // Dark background
        'dark-surface': '#181D27',      // Dark cards
        'dark-surface-hover': '#212735', // Dark hover
        'dark-surface-muted': '#131823', // Subtle dark area
        'dark-surface-inset': '#0B1018', // Dark inset areas
        'dark-border': '#313949',       // Dark borders
        'dark-border-light': '#232B38',  // Subtle dark dividers
        'dark-text': '#F3F6FB',         // Dark primary text
        'dark-text-secondary': '#C2CAD6', // Dark secondary text
        'dark-text-muted': '#9AA6B8',   // Dark muted text

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
            color: '#F3F6FB',
            a: {
              color: '#7CC2FF',
              '&:hover': {
                color: '#A6D8FF',
              },
            },
            code: {
              color: '#F3F6FB',
              backgroundColor: 'rgba(49, 57, 73, 0.6)',
              padding: '0.2em 0.4em',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            pre: {
              backgroundColor: '#121722',
              color: '#F3F6FB',
              padding: '1em',
              borderRadius: '0.75rem',
              overflowX: 'auto',
            },
            blockquote: {
              borderLeftColor: '#3B82F6',
              color: '#C2CAD6',
            },
            h1: {
              color: '#F3F6FB',
            },
            h2: {
              color: '#F3F6FB',
            },
            h3: {
              color: '#F3F6FB',
            },
            h4: {
              color: '#F3F6FB',
            },
            strong: {
              color: '#F3F6FB',
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
