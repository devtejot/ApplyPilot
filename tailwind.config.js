/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        // semantic tokens used by review badges (DESIGN.md §11)
        auto: '#16a34a', // green  — high-confidence autofill
        review: '#ca8a04', // yellow — needs user review
      },
    },
  },
  plugins: [],
};
