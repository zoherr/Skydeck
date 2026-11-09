/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0c10',
        surface: {
          DEFAULT: '#13161e',
          2: '#1c2030',
        },
        border: '#2a2f42',
        textPrimary: '#e8eaf0',
        textMuted: '#6b7280',
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
        },
        success: '#22c55e',
        error: '#ef4444',
        warning: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        card: '6px',
        input: '4px',
        btn: '3px',
      },
      transitionDuration: {
        150: '150ms',
      },
    },
  },
  plugins: [],
}
