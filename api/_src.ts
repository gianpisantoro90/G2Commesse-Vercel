/**
 * Vercel Serverless API Handler
 * This file is the source - it gets bundled to api/index.mjs during build
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../server/app-vercel';

// Create Express app once (reused across invocations)
const app = createApp();

// Vercel serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return new Promise<void>((resolve, reject) => {
    app(req as any, res as any, (err: any) => {
      if (err) {
        console.error('Express error:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
      resolve();
    });
  });
}
