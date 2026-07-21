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
    const manifestMod = await import('../dist/silvia-app/server/angular-app-manifest.mjs');
    console.log('[evento-ssr] manifest keys=%o', Object.keys(manifestMod));
    console.log('[evento-ssr] manifest default=%s', JSON.stringify(manifestMod.default, null, 0)?.slice(0, 1500));
  } catch (mErr) {
    console.log('[evento-ssr] manifest import failed: %s', mErr?.stack || mErr);
  }
  const slugId = req.query?.slugId;
  if (slugId) {
    req.url = `/eventi/${slugId}`;
  }
  console.log('[evento-ssr] forwarding url=%s host=%s', req.url, req.headers.host);
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
