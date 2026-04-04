/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        onda: {
          purple: '#a78bfa',
          'purple-dim': '#7c3aed',
          teal:   '#2dd4bf',
          'teal-dim': '#0d9488',
          bg:     '#09090b',
          card:   '#141414',
          border: '#27272a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
