/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        surface: '#121214',
        surfaceHover: '#1c1c1f',
        border: '#2a2a2e',
        primary: '#8b5cf6',
        text: '#e4e4e7',
        textDim: '#a1a1aa'
      }
    },
  },
  plugins: [],
}
