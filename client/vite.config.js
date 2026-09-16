import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const vercelConfig = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
// The security headers Vercel sends with every page; the deploy check makes sure the CSP allows the API.
const siteHeaders = Object.fromEntries(
  vercelConfig.headers.find((entry) => entry.source === '/(.*)').headers.map(({ key, value }) => [key, value])
);

// On Vercel (which sets VERCEL=1), refuse to build with deploy settings still missing, instead of shipping a site
// whose API calls or socket fail at runtime.
function checkVercelDeploy(mode) {
  if (!process.env.VERCEL) return;
  const problems = [];
  const apiRewrite = vercelConfig.rewrites.find((rewrite) => rewrite.source === '/api/:path*')?.destination ?? '';
  if (apiRewrite.includes('YOUR-RENDER-APP')) {
    problems.push('client/vercel.json still has the YOUR-RENDER-APP placeholder in its /api rewrite');
  }
  const apiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL;
  if (!apiUrl || !apiUrl.startsWith('https://') || apiUrl.endsWith('/')) {
    problems.push('VITE_API_URL must be set to the https:// API origin without a trailing slash');
  } else {
    const csp = siteHeaders['Content-Security-Policy'] ?? '';
    const wsUrl = apiUrl.replace(/^https:/, 'wss:');
    if (!csp.includes(apiUrl) || !csp.includes(wsUrl)) {
      problems.push(`the Content-Security-Policy in client/vercel.json must allow ${apiUrl} and ${wsUrl} in connect-src`);
    }
  }
  // Read by middleware.js at runtime; the API rejects forwarded client IPs without it.
  if ((process.env.PROXY_SECRET ?? '').trim().length < 32) {
    problems.push('PROXY_SECRET must be set (at least 32 characters, the same value as on Render)');
  }
  if (problems.length) throw new Error(`Deploy settings incomplete:\n- ${problems.join('\n- ')}`);
}

export default defineConfig(({ mode }) => {
  checkVercelDeploy(mode);
  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
  };
});
