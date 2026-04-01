// Simple SPA static server for dist/frontend/browser
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'dist', 'frontend', 'browser');
const PORT = process.env.PORT || 4200;

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain',
};

http.createServer((req, res) => {
  let filePath = path.join(ROOT, req.url.split('?')[0]);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(ROOT, 'index.html'); // SPA fallback
  }

  const ext  = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Kit Monitor frontend → http://localhost:${PORT}`);
});
