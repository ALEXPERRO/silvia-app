// Punto di ingresso per la funzione serverless Vercel che serve /eventi/:slugId.
// Le altre pagine (About me, Portfolio, Eventi, Shop) restano statiche/pre-generate
// come già funzionava: solo questa route dinamica ha bisogno di essere renderizzata
// per ogni richiesta (vedi RenderMode.Server in src/app/app.routes.server.ts), quindi
// è l'unica per cui serve una funzione dedicata invece del solo output statico.
export default async (req, res) => {
  const { reqHandler } = await import('../dist/silvia-app/server/server.mjs');
  // Vercel riscrive req.url nella destinazione (/api/evento-ssr?slugId=...)
  // prima che la funzione la riceva: il router di Angular non riconosce quel
  // percorso e finisce per renderizzare la home. Ripristiniamo qui il
  // percorso originale così reqHandler fa il match con /eventi/:slugId.
  const slugId = req.query?.slugId;
  console.log('[evento-ssr] incoming url=%s query=%o host=%s', req.url, req.query, req.headers.host);
  if (slugId) {
    req.url = `/eventi/${slugId}`;
  }
  console.log('[evento-ssr] forwarding url=%s', req.url);
  res.on('finish', () => console.log('[evento-ssr] response status=%s', res.statusCode));
  try {
    return await reqHandler(req, res);
  } catch (err) {
    console.log('[evento-ssr] reqHandler threw: %s', err?.stack || err);
    throw err;
  }
};
