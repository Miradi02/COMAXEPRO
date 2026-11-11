import type { Config } from 'tailwindcss';

const config: Config = {
  // Thème piloté par la classe `dark` sur <html> (préférence utilisateur
  // stockée en base, appliquée sans flash via le script inline du layout).
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // La pile de polices est pilotée par la préférence « Police »
      // (variable CSS --comaxe-font posée par PreferencesContext) : les
      // utilitaires `font-sans` et la balise <body> partagent la même source.
      fontFamily: {
        sans: ['var(--comaxe-font)'],
      },
      colors: {
        brand: {
          50: '#EFF4FF',
          100: '#DBE7FE',
          200: '#BFD5FE',
          300: '#93B9FD',
          400: '#6095FA',
          500: '#1E5BF8', // Primary hero blue from reference
          600: '#1548CF',
          700: '#1037A3',
          800: '#0E2E85',
          900: '#0C276B',
        },
        canvas: '#F8F9FD',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      }
    },
  },
  plugins: [],
};

export default config;
