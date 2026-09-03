import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getShopPreview } from '../src/core-server/etsy-shop-preview';

/**
 * Funzione serverless Vercel nativa (cartella api/ alla radice, convenzione
 * standard Vercel). Necessaria perché il sito è pubblicato come puramente
 * statico: tutte le route Angular sono Prerender/Client (vedi
 * src/app/app.routes.server.ts), quindi Vercel non deploya src/server.ts come
 * funzione — questo è l'unico endpoint che serve davvero in produzione.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600');
  res.status(200).json(await getShopPreview());
}
