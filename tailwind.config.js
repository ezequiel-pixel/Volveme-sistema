/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta oficial — Brand Identity Guidelines 2026 (sin tocar,
        // son los colores de marca real, cara al cliente)
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

        // Neutros del sistema — 2026, pero con el mismo ADN cálido del
        // PDF (papel marfil, no gris frío tipo "SaaS genérico"). El
        // canvas tiene un fondo de papel tenue con base del mismo
        // peach de marca (al 6% aprox), las tarjetas quedan blancas
        // puras arriba — así se lee la jerarquía sin depender de
        // bordes duros, pero sigue sintiéndose Volveme, no Apple.
        ink: '#2b1f21',       // casi-negro con base wine, no gris puro
        'ink-mid': '#6b5a54',  // gris cálido, mismo tono que ya usa el PDF
        'ink-light': '#a6968f',
        paper: '#faf6f2',      // papel marfil cálido — antes gris frío
        'paper-warm': '#ffe3d6',
        'paper-card': '#ffffff',
        rule: 'rgba(61,42,46,0.09)', // el borde ahora tiene tinte wine, no negro
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
        DEFAULT: '10px',
        lg: '14px',
        xl: '18px',
      },
      boxShadow: {
        // Sombras con tinte cálido (del wine, no negro puro) — mismo
        // criterio que el borde, para que todo el sistema comparta el
        // mismo "aire" que el PDF, no un shadow-md genérico.
        soft: '0 1px 2px rgba(61,42,46,0.05), 0 6px 20px -6px rgba(61,42,46,0.12)',
        'soft-lg': '0 2px 6px rgba(61,42,46,0.07), 0 20px 48px -16px rgba(61,42,46,0.18)',
      },
    },
  },
  plugins: [],
}
