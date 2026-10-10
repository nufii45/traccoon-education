import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { cloudOcrProxyPlugin } from './server/cloudOcrVitePlugin.ts'

// Local OCR always runs PaddleOCR.js with `worker: true`, and its prebuilt
// worker bundles its own OpenCV.js and ONNX Runtime Web. Its main-thread entry
// still imports both, so only those imports load a stub. Otherwise the build
// ships a 10 MB OpenCV.js chunk the main thread never uses and a 27 MiB ONNX
// Runtime binary, which is over Cloudflare's 25 MiB per-file asset limit.
const localOcrRuntimeStub = normalizePath(
  fileURLToPath(new URL('./src/features/local-ocr/mainThreadRuntimeStub.ts', import.meta.url)),
)

const localOcrWorkerOnlyRuntime = (): Plugin => ({
  name: 'traccoon:local-ocr-worker-only-runtime',
  enforce: 'pre',
  resolveId(source, importer) {
    const isWorkerOnlyRuntime = source === '@techstark/opencv-js' || source === 'onnxruntime-web'
    return isWorkerOnlyRuntime && importer && /[\\/]@paddleocr[\\/]paddleocr-js[\\/]/.test(importer)
      ? localOcrRuntimeStub
      : null
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    localOcrWorkerOnlyRuntime(),
    // Same-origin /api/cloud-ocr proxy for `vite` and `vite preview` only.
    cloudOcrProxyPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Traccoon Education',
        short_name: 'Traccoon',
        description: 'Local-first PDF study cards that stay on your device.',
        theme_color: '#2f6b3d',
        background_color: '#fcfdf9',
        display: 'standalone',
      },
      workbox: {
        // Default globs skip .mjs, .svg, .woff2 and .webp, which left the PDF.js
        // worker, icons, bundled fonts, Rokki art and treat art out of the offline cache.
        globPatterns: ['**/*.{js,mjs,css,html,svg,woff2,webp,png}'],
        // The 11 MB PaddleOCR.js worker is saved by the runtime rule below on
        // the first local OCR warm-up, not in every install.
        globIgnores: ['**/node_modules/**/*', '**/worker-entry-*.js'],
        maximumFileSizeToCacheInBytes: 9 * 1024 * 1024,
        // The default SPA fallback would answer /api/* navigations with
        // index.html; those must always reach the server.
        navigateFallbackDenylist: [/^\/api\//],
        // Local OCR files are saved on first warm-up so OCR then works offline.
        // Only these pinned files match (see src/features/local-ocr/config.ts),
        // so /api/cloud-ocr/* is never cached.
        runtimeCaching: [
          {
            urlPattern: /\/assets\/worker-entry-[\w-]+\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'traccoon-local-ocr-worker',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 2 },
            },
          },
          {
            urlPattern:
              /^https:\/\/(?:paddle-model-ecology\.bj\.bcebos\.com\/paddlex\/official_inference_model\/paddle3\.0\.0\/PP-OCRv5_mobile_(?:det|rec)_onnx_infer\.tar|cdn\.jsdelivr\.net\/npm\/onnxruntime-web@1\.24\.3\/dist\/ort-wasm-simd-threaded\.jsep\.wasm)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'traccoon-local-ocr-models',
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    // PaddleOCR.js finds its prebuilt worker next to its own module file, so the
    // dev server serves it from node_modules instead of prebundling it. Its
    // CommonJS and YAML dependencies are still prebundled.
    exclude: ['@paddleocr/paddleocr-js'],
    include: ['@paddleocr/paddleocr-js > clipper-lib', '@paddleocr/paddleocr-js > js-yaml'],
  },
})
