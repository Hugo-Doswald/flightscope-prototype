import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  server: {
    strictPort: true,
    host: '0.0.0.0'
  },
  envPrefix: ['VITE_', 'TAURI_']
});
