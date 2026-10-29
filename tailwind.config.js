/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bege: '#ede8df',
        'bege-escuro': '#e0d9cc',
        pimenta: '#fa300f',
        marinho: '#0f2a4f',
        chilli: '#cd1c18',
        celeste: '#00a8ff',
        pastel: '#ff746c',
        pago: '#008000',
        pendente: '#ffa500',
        atrasado: '#ff0000',
        tinta: '#2a1d1a',
      },
      fontFamily: {
        sans: ['Roboto', 'Arial', 'sans-serif'],
        serif: ['Bungee', 'sans-serif'],
      },
      boxShadow: { suave: '0 1px 2px rgba(42,29,26,.08), 0 4px 14px rgba(42,29,26,.06)' },
    },
  },
  plugins: [],
}
