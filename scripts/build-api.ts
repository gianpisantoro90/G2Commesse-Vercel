/**
 * Build script to bundle API for Vercel deployment
 * This bundles all server code into a single file that Vercel can use
 *
 * Source: api/_handler.ts (prefixed with _ so Vercel ignores it)
 * Output: api/index.js (Vercel deploys this as serverless function)
 */

import * as esbuild from 'esbuild';

async function build() {
  try {
    const result = await esbuild.build({
      entryPoints: ['api/_handler.ts'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: 'api/index.js',
      external: [
        // Keep native modules external - they're available in Vercel's runtime
        'bcrypt',
        'better-sqlite3',
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
      minify: false, // Keep readable for debugging
      sourcemap: true,
      metafile: true,
    });

    // Log bundle info
    const outputs = Object.keys(result.metafile?.outputs || {});
    console.log('API bundle created successfully!');
    console.log('Output files:', outputs.join(', '));
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
