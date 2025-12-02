// Placeholder - this file is overwritten during build by scripts/build-api.ts
// It exists so Vercel detects it as a serverless function before build runs
export default function handler(req, res) {
  res.status(500).json({ error: 'Build incomplete - placeholder not replaced' });
}
