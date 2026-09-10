/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const API_TARGET = 'http://localhost:6001'

// NestJS route prefixes — proxied in dev so the frontend uses same-origin requests.
const API_ROUTES =
  'auth|audit|notifications|buildings|floors|spaces|tenants|users|bookings|billing|maintenance|lease-contracts|reports|analytics|addon-services|space-features|price-plans|promotion-codes|booking-applications|tenant-applications|forms|upload|health|search|export|mail|ai|generate-pdf|sites|files|public'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      [`^/(${API_ROUTES})(/|$)`]: {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
      },
      '/socket.io': {
        target: API_TARGET,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('antd') || id.includes('@ant-design')) return 'vendor-antd'
            if (id.includes('recharts')) return 'vendor-charts'
          }
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/api/client.ts'],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 20,
        statements: 30,
      },
    },
  },
})
