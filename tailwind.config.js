/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4: scan all component files for className usage
  content: [
    './App.tsx',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ── Semantic tokens via CSS variables ─────────────────────────────
        // Light and dark values are set by the DARK_THEME / LIGHT_THEME vars()
        // objects in App.tsx. All components only reference these token names.
        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
          tertiary: 'var(--color-surface-tertiary)',
        },
        label: {
          primary: 'var(--color-label-primary)',
          secondary: 'var(--color-label-secondary)',
          tertiary: 'var(--color-label-tertiary)',
          quaternary: 'var(--color-label-quaternary)',
        },
        // ── Accent colors are theme-independent ───────────────────────────
        accent: {
          DEFAULT: '#007AFF',
          green: '#34C759',
          orange: '#FF9500',
          red: '#FF3B30',
          purple: '#5856D6',
          cyan: '#5AC8FA',
        },
      },
    },
  },
  plugins: [],
};
