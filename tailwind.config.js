/** @type {import('tailwindcss').Config} */

// Maps a CSS-variable token to a Tailwind color that supports the alpha modifier
// (bg-surface/50). Tokens are defined in src/ui/theme.css as HSL channel triplets.
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: { DEFAULT: token('surface'), muted: token('surface-muted') },
        fg: { DEFAULT: token('fg'), muted: token('fg-muted'), subtle: token('fg-subtle') },
        border: token('border'),
        accent: { DEFAULT: token('accent'), fg: token('accent-fg') },
        ring: token('ring'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        info: token('info'),
        reuse: token('reuse'),
        // Legacy aliases kept so existing `bg-auto`/`text-review` classes survive
        // migration (DESIGN.md §11). Point at the new semantic tokens.
        auto: token('success'),
        review: token('warning'),
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up-fade': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up-fade': 'slide-up-fade 0.18s ease-out',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};
