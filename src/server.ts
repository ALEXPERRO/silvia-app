import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

interface ShopPreviewItem {
  title: string;
  price: string;
  link: string;
  image: string;
}

const ETSY_SHOP_RSS_URL = 'https://www.etsy.com/shop/BloomingWildArtShop/rss';
const SHOP_PREVIEW_CACHE_TTL_MS = 15 * 60 * 1000;
const SHOP_PREVIEW_MAX_ITEMS = 8;

let shopPreviewCache: { items: ShopPreviewItem[]; expiresAt: number } | null = null;

/** Il feed RSS pubblico di Etsy (nessuna API key/OAuth) espone gli ultimi 10
 *  annunci del negozio; immagine e prezzo sono dentro <description> come
 *  markup HTML, quindi vanno estratti da lì una volta decodificate le entità XML. */
function parseEtsyRssItems(xml: string): ShopPreviewItem[] {
  const parser = new XMLParser({ ignoreAttributes: true });
  const rawItems = parser.parse(xml)?.rss?.channel?.item ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items
    .map((item): ShopPreviewItem | null => {
      const description = String(item?.description ?? '');
      const image = description.match(/<img src="([^"]+)"/)?.[1];
      const link = String(item?.link ?? '').trim();
      if (!image || !link) return null;

      const price = description.match(/<p class="price">([^<]+)<\/p>/)?.[1] ?? '';
      const title = String(item?.title ?? '').replace(/\s+by\s+BloomingWildArtShop$/i, '');

      return { title, price, link, image };
    })
    .filter((item): item is ShopPreviewItem => item !== null)
    .slice(0, SHOP_PREVIEW_MAX_ITEMS);
}

/**
 * Anteprima degli ultimi prodotti dello shop Etsy, letta dal feed RSS
 * pubblico del negozio e tenuta in cache per non richiamare Etsy ad ogni
 * apertura della pagina Shop.
 */
app.get('/api/shop-preview', async (_req, res) => {
  const now = Date.now();
  res.set('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600');

  if (shopPreviewCache && shopPreviewCache.expiresAt > now) {
    res.json(shopPreviewCache.items);
    return;
  }

  try {
    const response = await fetch(ETSY_SHOP_RSS_URL);
    if (!response.ok) throw new Error(`Etsy RSS ha risposto ${response.status}`);

    const items = parseEtsyRssItems(await response.text());
    shopPreviewCache = { items, expiresAt: now + SHOP_PREVIEW_CACHE_TTL_MS };
    res.json(items);
  } catch (error) {
    console.error('Impossibile recuperare le anteprime dello shop Etsy:', error);
    res.json(shopPreviewCache?.items ?? []);
  }
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
