/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta oficial — Brand Identity Guidelines 2026
        wine: '#3d2a2e',
        'wine-mid': '#5a4045',
        brown: '#8c5a45',
        terracota: '#a47864',
        'blue-dark': '#01269a',
        blue: '#3f6bff',
        'blue-light': '#b7ddff',
        orange: '#ff6a1a',
        coral: '#fd926f',
        'coral-light': '#fdece6',
        peach: '#ffe3d6',
        ink: '#222222',
        'ink-mid': '#57534f',
        'ink-light': '#a2a9ad',
        paper: '#ffffff',
        'paper-warm': '#ffe3d6',
        'paper-card': '#fdfaf8',
        rule: 'rgba(34,34,34,0.1)',
      },
      fontFamily: {
        // Glitz y Koegan aún no están subidos (ver comentario en index.css).
        // Mientras tanto: DM Serif Display como respaldo de título
        // (ya se carga en index.html) y Yellowtail como respaldo de script.
        display: ['Glitz', '"DM Serif Display"', 'serif'],
        sans: ['"BR Omny"', 'DM Sans', 'sans-serif'],
        accent: ['Koegan', '"Yellowtail"', 'cursive'],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
}
