import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const cesiumSource = 'node_modules/cesium/Build/Cesium'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/ThirdParty`, dest: 'cesium', rename: { stripBase: 4 } },
        { src: `${cesiumSource}/Workers`, dest: 'cesium', rename: { stripBase: 4 } },
        { src: `${cesiumSource}/Assets`, dest: 'cesium', rename: { stripBase: 4 } },
        { src: `${cesiumSource}/Widgets`, dest: 'cesium', rename: { stripBase: 4 } },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': __dirname + '/src',
    },
  },
  optimizeDeps: {
    include: ['cesium'],
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium/'),
  },
  // Proxy /api/* to local FastAPI during development.
  // Narrowed to '/api/' so client routes like /api-docs are served by the
  // SPA fallback instead of being proxied to the backend.
  server: {
    proxy: {
      '/api/': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // FastAPI OpenAPI schema + Swagger UI for the API Documentation page.
      // Not prefixed with /api/ — these are root-level backend routes.
      '/openapi.json': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/docs': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
