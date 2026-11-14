import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  root: __dirname,
  plugins: [react()],
  // Polling: on Windows the native watcher sometimes misses an edit that lands right after
  // another, leaving the dev server serving a stale module (seen as blank-page crashes).
  server: { port: 5178, fs: { allow: ['..'] }, watch: { usePolling: true, interval: 150 } },
  build: { outDir: '../dist-ui', emptyOutDir: true },
  define: {
    // User-supplied role icons (ui/role-icons/): always in dev, only on request in builds,
    // so a published build never ships images the user added for personal use.
    __ROLE_ICONS__: JSON.stringify(command === 'serve' || process.env.ROLE_ICONS === 'include'),
  },
}));
