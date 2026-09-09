import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

function apkMimePlugin() {
  return {
    name: 'apk-mime-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.includes('.apk')) {
          res.setHeader('Content-Type', 'application/vnd.android.package-archive');
          res.setHeader('Content-Disposition', 'attachment; filename="diet-tracker.apk"');
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), apkMimePlugin()],
  server: {
    host: true, // Listen on all local IP addresses (0.0.0.0)
    port: 5173,
    allowedHosts: true, // Allow tunnel domains and all host headers
    proxy: {
      '/gemini-api': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gemini-api/, ''),
      },
    },
    watch: {
      ignored: ['**/android/**', '**/android/app/**', '**/*.apk'],
    },
  },
})

