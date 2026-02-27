/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // Category icon container + icon color (used via getCategoryIconStyle; dynamic classes are purged otherwise)
    'bg-amber-100', 'text-amber-800',
    'bg-blue-100', 'text-blue-800', 'bg-blue-200', 'text-blue-900',
    'bg-violet-100', 'text-violet-800',
    'bg-teal-100', 'text-teal-800',
    'bg-emerald-100', 'text-emerald-800',
    'bg-pink-100', 'text-pink-800',
    'bg-indigo-100', 'text-indigo-800',
    'bg-rose-100', 'text-rose-800',
    'bg-cyan-100', 'text-cyan-800',
    'bg-sky-100', 'text-sky-800',
    'bg-gray-100', 'text-gray-700',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
