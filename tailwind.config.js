/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        kai: ['"LXGW WenKai TC"', '"BiauKai"', '"DFKai-SB"', '"標楷體"', '"Kaiti TC"', "serif"],
      },
    },
  },
  plugins: [],
}
