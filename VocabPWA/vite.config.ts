// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Vocab PWA',
        short_name: 'Vocab',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b0f19',
        theme_color: '#4f46e5',
        icons: [
          { src: '/icons/manifest-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/manifest-icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  define: {
    'process.env': {} // 일부 라이브러리의 process.env 접근 방지용
  },
  optimizeDeps: {
    exclude: ['sql.js', 'pdfjs-dist'] // 미리 번들 최적화에서 제외
  }
})