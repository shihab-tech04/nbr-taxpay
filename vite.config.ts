import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Keep local / AI Studio previews at "/", while publishing GitHub Pages
// assets underneath the repository's project-site subpath.
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/nbr-taxpay/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
});
