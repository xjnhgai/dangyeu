import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages project site for the repository named "xinhgai".
  base: '/xinhgai/',

  plugins: [
    react(),

    VitePWA({
      // Không tự động tải lại ứng dụng khi có phiên bản mới.
      // Người dùng sẽ được hỏi trước khi cập nhật.
      registerType: 'prompt',

      manifest: {
        name: 'Calculator App',
        short_name: 'Calculator',
        description: 'Ứng dụng tính toán cá nhân, hỗ trợ làm việc ngoại tuyến.',
        start_url: '/xinhgai/',
        scope: '/xinhgai/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#f4f6f8',
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
})
