/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#E1F5EE', 100: '#9FE1CB', 200: '#5DCAA5',
          500: '#1D9E75', 700: '#0F6E56', 900: '#04342C',
        }
      }
    }
  },
  plugins: [],
}
