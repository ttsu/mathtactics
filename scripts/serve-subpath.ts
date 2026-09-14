#!/usr/bin/env -S npx tsx
// Minimal static file server that serves a built `dist/` directory mounted under a URL
// prefix (e.g. "/pr/pr-0/"), the same shape a PR preview is served at in production
// (rossjrw/pr-preview-action under `umbrella-dir: pr`). Used by the Playwright subpath
// verification (e2e/subpath.spec.ts, task 02 requirement 6) to prove the relative
// `base: './'` build (task 01) resolves its assets correctly from a non-root path, not
// just from "/". Not a general-purpose server — test-only tooling.
//
// Usage: tsx scripts/serve-subpath.ts --dir dist --port 4174 --prefix /pr/pr-0/

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

function parseArgs(argv: string[]): { dir: string; port: number; prefix: string } {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token?.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (value !== undefined) {
        args.set(key, value);
        i += 1;
      }
    }
  }
  const dir = args.get('dir') ?? 'dist';
  const port = Number(args.get('port') ?? '4174');
  let prefix = args.get('prefix') ?? '/pr/pr-0/';
  if (!prefix.startsWith('/')) prefix = `/${prefix}`;
  if (!prefix.endsWith('/')) prefix = `${prefix}/`;
  return { dir, port, prefix };
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const { dir, port, prefix } = parseArgs(process.argv.slice(2));

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    if (!pathname.startsWith(prefix)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end(`not found (outside of mounted prefix ${prefix})`);
      return;
    }

    let relPath = pathname.slice(prefix.length);
    if (relPath === '' || relPath.endsWith('/')) relPath += 'index.html';

    const filePath = normalize(join(dir, relPath));
    if (!filePath.startsWith(normalize(dir))) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }

    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error('not a file');
      const body = await readFile(filePath);
      const contentType = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
      res.writeHead(200, { 'content-type': contentType });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end(`not found: ${pathname}`);
    }
  })();
});

server.listen(port, () => {
  console.log(`serve-subpath: serving "${dir}" at http://localhost:${port}${prefix}`);
});
