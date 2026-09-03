import { XMLParser } from 'fast-xml-parser';

export interface ShopPreviewItem {
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
 * pubblico del negozio e tenuta in cache in memoria (per processo) per non
 * richiamare Etsy ad ogni apertura della pagina Shop.
 */
export async function getShopPreview(): Promise<ShopPreviewItem[]> {
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
