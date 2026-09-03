import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, node: process.version }));
}
