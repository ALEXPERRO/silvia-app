import type { IncomingMessage, ServerResponse } from 'node:http';
import { XMLParser } from 'fast-xml-parser';

/**
 * Funzione serverless Vercel nativa (cartella api/ alla radice, convenzione
 * standard Vercel). Necessaria perché il sito è pubblicato come puramente
 * statico: tutte le route Angular sono Prerender/Client (vedi
 * src/app/app.routes.server.ts), quindi Vercel non deploya src/server.ts come
 * funzione — questo è l'unico endpoint che serve davvero in produzione.
 *
 * Logica duplicata (non importata da src/core-server/etsy-shop-preview.ts,
 * usato invece da server.ts per i test in locale): un import che attraversa
 * il confine della cartella api/ ha causato un FUNCTION_INVOCATION_FAILED in
 * produzione, probabilmente perché il file importato non eredita lo scope
 * ESM di api/package.json. Tenerla autosufficiente evita il problema.
 */

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

async function getShopPreview(): Promise<ShopPreviewItem[]> {
  const now = Date.now();
  if (shopPreviewCache && shopPreviewCache.expiresAt > now) {
    return shopPreviewCache.items;
  }

  try {
    const response = await fetch(ETSY_SHOP_RSS_URL);
    if (!response.ok) throw new Error(`Etsy RSS ha risposto ${response.status}`);

    const items = parseEtsyRssItems(await response.text());
    shopPreviewCache = { items, expiresAt: now + SHOP_PREVIEW_CACHE_TTL_MS };
    return items;
  } catch (error) {
    console.error('Impossibile recuperare le anteprime dello shop Etsy:', error);
    return shopPreviewCache?.items ?? [];
  }
}

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600');
  res.statusCode = 200;
  res.end(JSON.stringify(await getShopPreview()));
}
