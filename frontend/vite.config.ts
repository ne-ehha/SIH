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
  // Proxy /api/* to local FastAPI during development
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
