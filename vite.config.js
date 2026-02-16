import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 🚨 This is the new line telling Vite it lives in the "paybot" GitHub repo!
  base: '/paybot/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/pingpay-api': {
        // 🚨 UPDATED TARGET URL!
        target: 'https://pay.pingpay.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pingpay-api/, '')
      }
    }
  }
})