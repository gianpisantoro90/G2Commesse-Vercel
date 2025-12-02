/**
 * Vercel Serverless API Handler
 * Wraps Express app for Vercel deployment
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { type Request, Response, NextFunction } from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';

// Import routes registration (we'll create a simplified version)
import { createApp } from '../server/app-vercel';

// Create and configure Express app
const app = createApp();

// Export for Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle the request with Express
  return new Promise((resolve, reject) => {
    app(req as any, res as any, (err: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(undefined);
      }
    });
  });
}
