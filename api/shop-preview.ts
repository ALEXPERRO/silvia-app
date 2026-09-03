import type { IncomingMessage, ServerResponse } from 'node:http';
import { getShopPreview } from '../src/core-server/etsy-shop-preview';

/**
 * Funzione serverless Vercel nativa (cartella api/ alla radice, convenzione
 * standard Vercel). Necessaria perché il sito è pubblicato come puramente
 * statico: tutte le route Angular sono Prerender/Client (vedi
 * src/app/app.routes.server.ts), quindi Vercel non deploya src/server.ts come
 * funzione — questo è l'unico endpoint che serve davvero in produzione.
 *
 * Usa i tipi nativi di node:http invece di @vercel/node: quel pacchetto è una
 * devDependency, e importarlo qui (anche solo come tipo) ha causato un
 * FUNCTION_INVOCATION_FAILED in produzione — probabilmente perché l'ambiente
 * di runtime della funzione non installa le devDependencies.
 */
export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600');
  res.statusCode = 200;
  res.end(JSON.stringify(await getShopPreview()));
}
