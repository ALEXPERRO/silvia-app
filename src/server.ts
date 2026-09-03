import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { getShopPreview } from './core-server/etsy-shop-preview';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Anteprima degli ultimi prodotti dello shop Etsy (vedi core-server/etsy-shop-preview.ts).
 * NOTA: in produzione su Vercel questo endpoint non viene servito da qui — tutte le
 * route Angular sono Prerender/Client, quindi Vercel pubblica il sito come puramente
 * statico e non deploya questo server Express come funzione. La versione che serve
 * davvero in produzione è api/shop-preview.ts (funzione serverless Vercel nativa,
 * rilevata a prescindere dal preset Angular). Questa route resta solo per lo
 * sviluppo/test in locale con `node dist/.../server.mjs`.
 */
app.get('/api/shop-preview', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600');
  res.json(await getShopPreview());
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
