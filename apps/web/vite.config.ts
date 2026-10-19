import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true, proxy: { '/api': apiTarget, '/images': apiTarget } },
  preview: { port: 4173, strictPort: true, proxy: { '/api': apiTarget, '/images': apiTarget } },
  build: { target: ['chrome111', 'safari16.4'] },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', restoreMocks: true },
});
