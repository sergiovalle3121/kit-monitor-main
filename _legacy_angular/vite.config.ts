import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: ['.trycloudflare.com'], 
    host: '0.0.0.0',
    port: 4200,
  },
});
