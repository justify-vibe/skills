const { createServer } = require('http');
const { statSync, createReadStream } = require('fs');
const { extname, join, resolve, isAbsolute } = require('path');

const port = Number(process.env.UI_CAPTURE_PORT || 5178);
// Use script-relative default root; if UI_CAPTURE_ROOT is set and relative, interpret relative to this script dir (not process.cwd())
const defaultRoot = resolve(__dirname, '..', 'proto');
const rawRoot = process.env.UI_CAPTURE_ROOT;
const root = rawRoot
  ? (isAbsolute(rawRoot) ? rawRoot : resolve(__dirname, '..', rawRoot))
  : defaultRoot;

const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function contentType(filePath) {
  const type = mime[extname(filePath).toLowerCase()] || 'application/octet-stream';
  const needCharset = type.startsWith('text/') || type.includes('json') || type.includes('svg');
  return needCharset ? `${type}; charset=utf-8` : type;
}

createServer((req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('Method Not Allowed');
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);
    const urlPath = decodeURIComponent(url.pathname);
    const rel = urlPath === '/' ? '/index.html' : urlPath;

    let filePath = resolve(root, '.' + rel);

    // Prevent path traversal
    if (!filePath.startsWith(root)) {
      res.statusCode = 403;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('Forbidden');
      return;
    }

    let st;
    try {
      st = statSync(filePath);
      if (st.isDirectory()) {
        // Serve directory index.html
        filePath = resolve(filePath, 'index.html');
        st = statSync(filePath);
      }
    } catch (_) {
      // fallthrough to 404
    }

    if (!st || !st.isFile()) {
      res.statusCode = 404;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('Not Found');
      return;
    }

    res.setHeader('content-type', contentType(filePath));
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('access-control-allow-origin', '*');

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    createReadStream(filePath).pipe(res);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Internal Server Error');
  }
}).listen(port, () => {
  console.log(`[ui-capture] serving ${root} at http://localhost:${port}`);
});
