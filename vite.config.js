import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import sitePlugin from './seo/vite-plugin-site.js';

export default defineConfig({
  plugins: [react(), sitePlugin()],
  server: { port: 5173, open: true },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      // the piece itself, plus the static pages search engines and people read
      input: {
        main: 'index.html',
        about: 'about.html',
        legal: 'legal.html',
        notFound: '404.html',
      },
    },
  },
  // the fly is a large binary; keep it out of the JS graph
  assetsInclude: ['**/*.glb'],
});
