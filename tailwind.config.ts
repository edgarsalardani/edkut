import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        edkut: {
          bg: "#E7F1FC",
          bgAlt: "#DCEAFA",
          card: "#FFFFFF",
          border: "#CBDFF3",
          borderStrong: "#AFC9E6",
          blue: "#1D4E89",
          blueDark: "#0F3253",
          blueMid: "#2C67AA",
          blueSoft: "#EEF5FD",
          pink: "#D81B85",
          pinkDark: "#A9146A",
          pinkSoft: "#FBE7F2",
          text: "#28374A",
          muted: "#63768E",
          faint: "#8CA0B8",
          green: "#3FA66B",
          amber: "#C98A1B",
        },
      },
      fontFamily: {
        sans: [
          "Verdana",
          "Geneva",
          "Tahoma",
          "ui-sans-serif",
          "sans-serif",
        ],
        heading: [
          '"Trebuchet MS"',
          "Verdana",
          "ui-sans-serif",
          "sans-serif",
        ],
      },
      fontSize: {
        xs: ["11px", "15px"],
        sm: ["12.5px", "17px"],
        base: ["13.5px", "19px"],
        md: ["15px", "21px"],
        lg: ["18px", "24px"],
        xl: ["22px", "28px"],
      },
      borderRadius: {
        edkut: "7px",
      },
      boxShadow: {
        edkut: "0 1px 2px rgba(15, 50, 83, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
