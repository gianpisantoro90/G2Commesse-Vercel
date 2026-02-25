/**
 * Vercel Serverless API Handler
 * This file is the source - it gets bundled to api/index.js during build
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../server/app-vercel';

// Lazy init: create Express app once (reused across invocations within same cold start)
let appPromise: ReturnType<typeof createApp> | null = null;

function getApp() {
  if (!appPromise) {
    appPromise = createApp();
  }
  return appPromise;
}

// Disable Vercel's body parser — Express handles parsing + gzip decompression
export const config = {
  api: {
    bodyParser: false,
  },
};

// Vercel serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  return new Promise<void>((resolve) => {
    app(req as any, res as any, (err: any) => {
      if (err) {
        console.error('Express error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
      resolve();
    });
  });
}
