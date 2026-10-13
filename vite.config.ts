import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH lets a host pin an absolute subpath (e.g. "/play/"). The default "./" makes
// dist/ relocatable: the same build works at "/", "/play/" or any other subpath.
const base = process.env.BASE_PATH ?? './';

export default defineConfig(({ mode }) => ({
  base,
  define: {
    // Dev tools (perf overlay, stroke editor, cue recorder) exist in dev and "qa" builds only.
    __DEV_TOOLS__: JSON.stringify(mode !== 'production'),
  },
  build: {
    outDir: mode === 'qa' ? 'dist-qa' : 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      input: { main: 'index.html' },
    },
  },
  server: { port: 5173, strictPort: true },
  plugins: [
    VitePWA({
      // Phase 5 switches this on.
      disable: true,
      injectRegister: 'script',
      manifest: false,
    }),
  ],
}));
