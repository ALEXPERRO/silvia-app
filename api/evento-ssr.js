// Punto di ingresso per la funzione serverless Vercel che serve /eventi/:slugId.
// Le altre pagine (About me, Portfolio, Eventi, Shop) restano statiche/pre-generate
// come già funzionava: solo questa route dinamica ha bisogno di essere renderizzata
// per ogni richiesta (vedi RenderMode.Server in src/app/app.routes.server.ts), quindi
// è l'unica per cui serve una funzione dedicata invece del solo output statico.
export default async (req, res) => {
  const { reqHandler, ngAppDiag } = await import('../dist/silvia-app/server/server.mjs');
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
