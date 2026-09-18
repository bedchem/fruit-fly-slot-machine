import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  // the fly is a large binary; keep it out of the JS graph
  assetsInclude: ['**/*.glb'],
});
