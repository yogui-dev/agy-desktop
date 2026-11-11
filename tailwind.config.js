/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0d1117',
        surface: '#161b22',
        'surface-hover': '#21262d',
        border: '#30363d',
        primary: '#388bfd',
        'primary-hover': '#58a6ff',
        accent: '#238636',
        warning: '#d29922',
        danger: '#f85149',
      }
    },
  },
  plugins: [],
}
