/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#D6293B", dark: "#B01F2E" },
        secondary: { DEFAULT: "#F5A623", light: "#FDEBC9" },
        neutral: {
          // 400–600 digelapkan agar teks sekunder lolos kontras WCAG AA (≥4,5:1)
          // di atas background krem; sebelumnya 400 = 2,3:1 dan 500 = 3,9:1.
          50: "#FAF7F4", 100: "#F3ECE4", 200: "#EBE1D8", 300: "#D9CBBE",
          400: "#74655C", 500: "#6B5D54", 600: "#584B43", 700: "#4F433C",
          800: "#382E29", 900: "#2B211D", 950: "#1A1310",
        },
        background: "#FFF8F1",
        surface: "#FFFFFF",
        // Sama dengan green-700 Tailwind agar satu keluarga dengan badge/tint green-*
        // (sebelumnya #4B7A57, hijau kusam yang berbeda dari badge "Lunas").
        success: "#15803D",
        danger: "#B01F2E",
      },
      fontFamily: {
        // Judul memakai Plus Jakarta Sans (sama dengan body); kelas font-display
        // dipertahankan agar mudah diganti ke font display lain di kemudian hari.
        display: ['"Plus Jakarta Sans"', "sans-serif"],
        body: ['"Plus Jakarta Sans"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
