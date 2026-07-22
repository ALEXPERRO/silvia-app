// Punto di ingresso unico per tutte le richieste su Vercel.
// Il filesystem-routing di Vercel intercetta e serve index.html/index.csr.html
// direttamente per qualunque path, bypassando le rewrite parziali (bug noto per
// Angular SSR su Vercel). Instradando ogni richiesta qui, è il server Angular
// stesso (server.mjs) a decidere staticamente/via SSR cosa servire, in base
// alle RenderMode configurate in src/app/app.routes.server.ts.
export default async (req, res) => {
  console.log('[api] req.url=%s', req.url);
  const { reqHandler } = await import('../dist/silvia-app/server/server.mjs');
  return reqHandler(req, res);
};
