/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#D6293B", dark: "#B01F2E" },
        secondary: { DEFAULT: "#F5A623", light: "#FDEBC9" },
        neutral: {
          50: "#FAF7F4", 100: "#F3ECE4", 200: "#EBE1D8", 300: "#D9CBBE",
          400: "#B3A296", 500: "#8A7B72", 600: "#6B5D54", 700: "#4F433C",
          800: "#382E29", 900: "#2B211D", 950: "#1A1310",
        },
        background: "#FFF8F1",
        surface: "#FFFFFF",
        success: "#4B7A57",
        danger: "#B01F2E",
      },
      fontFamily: {
        display: ["Baloo 2", "cursive"],
        body: ["Plus Jakarta Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
