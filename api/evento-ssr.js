// Punto di ingresso per la funzione serverless Vercel che serve /eventi/:slugId.
// Le altre pagine (About me, Portfolio, Eventi, Shop) restano statiche/pre-generate
// come già funzionava: solo questa route dinamica ha bisogno di essere renderizzata
// per ogni richiesta (vedi RenderMode.Server in src/app/app.routes.server.ts), quindi
// è l'unica per cui serve una funzione dedicata invece del solo output statico.
process.on('unhandledRejection', (reason) => {
  console.log('[evento-ssr] UNHANDLED REJECTION: %s', reason?.stack || reason);
});
process.on('uncaughtException', (err) => {
  console.log('[evento-ssr] UNCAUGHT EXCEPTION: %s', err?.stack || err);
});

export default async (req, res) => {
  const { reqHandler, ngAppDiag } = await import('../dist/silvia-app/server/server.mjs');
  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.join(__dirname, '../dist/silvia-app/server');
    const files = fs.readdirSync(dir);
    console.log('[evento-ssr] server dir (%s) has %d files: %s', dir, files.length, files.join(','));
  } catch (fErr) {
    console.log('[evento-ssr] readdir failed: %s', fErr?.stack || fErr);
  }
  try {
    const mod = await import('../dist/silvia-app/server/chunk-2VRS3FJ6.mjs');
    console.log('[evento-ssr] evento-dettaglio chunk import OK, keys=%o', Object.keys(mod));
  } catch (cErr) {
    console.log('[evento-ssr] evento-dettaglio chunk import FAILED: %s', cErr?.stack || cErr);
  }
  const slugId = req.query?.slugId;
  if (slugId) {
    req.url = `/eventi/${slugId}`;
  }
  console.log('[evento-ssr] forwarding url=%s host=%s', req.url, req.headers.host);
  console.log('[evento-ssr] req.method=%s req.httpVersion=%s ctor=%s hasSocket=%s', req.method, req.httpVersion, req.constructor?.name, !!req.socket);
  console.log('[evento-ssr] req.headers=%s', JSON.stringify(req.headers));
  try {
    const diag = await ngAppDiag.handle(req);
    if (!diag) {
      console.log('[evento-ssr] ngAppDiag.handle returned null (no route match)');
    } else {
      const text = await diag.clone().text();
      console.log('[evento-ssr] ngAppDiag.handle status=%s bodyPreview=%s', diag.status, text.slice(0, 250));
    }
  } catch (diagErr) {
    console.log('[evento-ssr] ngAppDiag.handle threw: %s', diagErr?.stack || diagErr);
  }
  return reqHandler(req, res);
};
