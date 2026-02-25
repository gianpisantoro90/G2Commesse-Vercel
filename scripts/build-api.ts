/**
 * Build script to bundle API for Vercel deployment
 * Bundles all server code into a single ESM file for Vercel serverless
 *
 * Source: api/_src.ts (underscore prefix = Vercel ignores)
 * Output: api/index.js (overwrites placeholder, Vercel deploys as serverless function)
 */

import * as esbuild from 'esbuild';

async function build() {
  try {
    const result = await esbuild.build({
      entryPoints: ['api/_src.ts'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: 'api/index.js',
      external: [
        // Native modules and complex packages - loaded from node_modules at runtime
        'better-sqlite3',
        'bcrypt',           // Native C++ module - use bcryptjs instead
        '@libsql/client',   // Has complex internals that don't bundle well
        'ws',               // Only used in local dev, not needed on Vercel
      ],
      banner: {
        js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`.trim(),
      },
      minify: false,
      sourcemap: false,
      metafile: true,
    });

    const outputs = Object.keys(result.metafile?.outputs || {});
    console.log('API bundled:', outputs.join(', '));
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
