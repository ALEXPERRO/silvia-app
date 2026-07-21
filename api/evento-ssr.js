// Punto di ingresso per la funzione serverless Vercel che serve /eventi/:slugId.
// Le altre pagine (About me, Portfolio, Eventi, Shop) restano statiche/pre-generate
// come già funzionava: solo questa route dinamica ha bisogno di essere renderizzata
// per ogni richiesta (vedi RenderMode.Server in src/app/app.routes.server.ts), quindi
// è l'unica per cui serve una funzione dedicata invece del solo output statico.
export default async (req, res) => {
  const { reqHandler } = await import('../dist/silvia-app/server/server.mjs');
  return reqHandler(req, res);
};
