import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname, 'src', 'renderer'),
  base: './',
  plugins: [react()],
  build: {
    emptyOutDir: false
  }
});
