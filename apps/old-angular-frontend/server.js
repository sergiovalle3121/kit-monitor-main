// frontend/server.js
const express = require('express');
const path = require('path');
const app = express();

const distDir = path.join(__dirname, 'dist', 'frontend');

// Cachea assets estáticos, NO el index.html
app.use(express.static(distDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Endpoints de diagnóstico opcionales
app.get('/__version', (_req, res) => {
  res.json({ builtAt: new Date().toISOString(), commit: process.env.RAILWAY_GIT_COMMIT || 'local' });
});
app.get('/__health', (_req, res) => res.send('ok'));

// Catch-all: devuelve index.html para rutas del router
app.get('*', (_req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(distDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Frontend servido en :${PORT}`));
