
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command, isPreview }) => {
  const appBase = command === 'build' || isPreview ? '/dangyeu/' : '/'
  return {
  base: appBase,
  plugins: [
    react(),

    VitePWA({
      // Không tự động tải lại ứng dụng khi có phiên bản mới.
      // Người dùng sẽ được hỏi trước khi cập nhật.
      registerType: 'prompt',

      includeAssets: ['icons/*.png', 'icons/*.svg', 'love/*.gif', 'love/*.png', 'fonts/*.woff'],

      manifest: {
        id: appBase,
        name: 'ĐẹpGái',
        short_name: 'ĐẹpGái',
        lang: 'vi',
        description: 'Ứng dụng tính toán cá nhân, hỗ trợ làm việc ngoại tuyến.',
        start_url: appBase,
        scope: appBase,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#fff0f5',
        icons: [
          { src: `${appBase}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${appBase}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${appBase}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // Các tài nguyên cần lưu để ứng dụng có thể mở ngoại tuyến.
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,webmanifest}',
        ],

        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
}
})
