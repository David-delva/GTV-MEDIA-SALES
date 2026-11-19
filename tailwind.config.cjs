/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/frontend/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gtv: {
          blue: '#003189',
          'blue-dark': '#002070',
          green: '#009A44',
          yellow: '#FCD116',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
