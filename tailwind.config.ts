import type { Config } from 'tailwindcss';

/**
 * MutationGuard colour system ("Surveyor's Ledger").
 *
 * The pages already use Tailwind's standard colour names (emerald, slate, rose, amber ...).
 * Instead of editing every page, we REDEFINE those names here, so changing a colour in this
 * one file changes it everywhere:
 *   emerald -> pine green   (primary buttons, active navigation, success)
 *   slate   -> warm neutrals (text, borders, surfaces; slate-100 is the drafting-paper colour)
 *   amber   -> survey amber  (highlights, demo marks; use sparingly)
 *   rose    -> alert red     (genuine conflicts and errors only)
 *   blue    -> ink blue-grey (links and neutral information)
 */
const pine = {
  50: '#F1F5F0', 100: '#E5E9E2', 200: '#C9D5CC', 300: '#9DB4A5', 400: '#7FA68D',
  500: '#3E6753', 600: '#183D32', 700: '#12302A', 800: '#0E241F', 900: '#0A1A16', 950: '#060F0C',
};
const paper = {
  50: '#FAF8F3', 100: '#F5F2E9', 200: '#E6E1D2', 300: '#D2CCB9', 400: '#9B9886',
  500: '#686B63', 600: '#4E534D', 700: '#3A3F3B', 800: '#2E3330', 900: '#282D2A', 950: '#1B1F1C',
};
const amber = {
  50: '#FBF6E8', 100: '#F5EAC8', 200: '#EBD497', 300: '#E0BC6E', 400: '#D4A34F',
  500: '#B98A36', 600: '#946B22', 700: '#74531B', 800: '#5A4017', 900: '#3F2D10', 950: '#241908',
};
const red = {
  50: '#FBF1EF', 100: '#F6DFDB', 200: '#EBBFB8', 300: '#DC968D', 400: '#C76A60',
  500: '#B54D44', 600: '#A33D35', 700: '#86302A', 800: '#692622', 900: '#4E1D1A', 950: '#2F100E',
};
const ink = {
  50: '#F0F4F6', 100: '#DDE6EA', 200: '#BCCDD6', 300: '#90A9B8', 400: '#628399',
  500: '#46687B', 600: '#35505F', 700: '#2A3F4C', 800: '#212F3A', 900: '#192530', 950: '#0F171E',
};

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        emerald: pine, green: pine, teal: pine, lime: pine,
        slate: paper,
        amber, orange: amber, yellow: amber,
        rose: red, red,
        blue: ink, indigo: ink, sky: ink, cyan: ink, violet: ink, purple: ink,
        gov: { green: '#183D32', red: '#A33D35', accent: '#35505F' },
      },
    },
  },
  plugins: [],
};

export default config;