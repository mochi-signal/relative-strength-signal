// docs/ をローカルで確認するための簡易サーバー
//   node scripts/serve.mjs  →  http://localhost:8000/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize } from 'node:path';

const docs = new URL('../docs/', import.meta.url);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const port = Number(process.env.PORT) || 8000;

createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[\\/]+/, '');
  if (p === '' || p.endsWith('/') || p.endsWith('\\')) p += 'index.html';
  try {
    const body = await readFile(new URL(p.replaceAll('\\', '/'), docs));
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}/`));
