/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://127.0.0.1:4000'
    }
  },
  test: {
    exclude: ['**/node_modules/**', '**/.worktrees/**', 'dist/**', 'tools/**', 'mixin9---audio-batch-mixing-software/**']
  }
});
