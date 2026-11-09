/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#111111',
          800: '#18191E',
          700: '#23242A',
          600: '#333333'
        },
        gray: {
          50: '#F9FAFB',
          100: '#F5F5F5',
          200: '#EAEAEA',
          300: '#D9D9D9',
          400: '#9E9E9E',
          500: '#757575',
          600: '#525252'
        },
        tint: {
          lavender: '#F2EFFB',
          blue: '#EEF3F8',
          sand: '#FAF5EA',
          slate: '#F1F4F8'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Inter"', '"Source Sans 3"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
