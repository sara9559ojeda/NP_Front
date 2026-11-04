/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      // With the real backend, /api goes through the dev server so the refresh
      // cookie stays same-origin (SameSite=Strict, path /api/v1/auth).
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: false },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
    },
  };
});
