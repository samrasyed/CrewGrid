/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: '#FBF2E1', dark: '#F2E4C9' },
        ink: { DEFAULT: '#1A1A1A', soft: '#4A453E', mute: '#6B6459' },
        paper: '#FFFFFF',
        tomato: { DEFAULT: '#FF5C39', ink: '#B8321A' },
        mustard: '#FFC21A',
        mint: { DEFAULT: '#46D39A', ink: '#1F7A55' },
        sky: '#5AB2FF',
        lilac: '#A98BFF',
        pink: '#FF92C2',
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Figtree', 'sans-serif'],
      },
      boxShadow: {
        hard: '4px 4px 0 0 #1A1A1A',
        'hard-sm': '2px 2px 0 0 #1A1A1A',
        'hard-lg': '8px 8px 0 0 #1A1A1A',
      },
    },
  },
  plugins: [],
}
