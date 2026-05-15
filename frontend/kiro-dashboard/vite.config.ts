import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // CJS wallet SDKs inside stellar-wallets-kit reference Node's `global`.
  // `define` covers source transforms; `optimizeDeps.esbuildOptions.define`
  // covers the pre-bundling step where CJS → ESM conversion happens.
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
