import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// On Vercel (which sets VERCEL=1), refuse to build with deploy settings still missing, instead of shipping a site
// whose API calls or socket fail at runtime.
function checkVercelDeploy(mode) {
  if (!process.env.VERCEL) return;
  const problems = [];
  if (readFileSync(new URL('./vercel.json', import.meta.url), 'utf8').includes('YOUR-RENDER-APP')) {
    problems.push('client/vercel.json still has the YOUR-RENDER-APP placeholder in its /api rewrite');
  }
  const apiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL;
  if (!apiUrl || !apiUrl.startsWith('https://') || apiUrl.endsWith('/')) {
    problems.push('VITE_API_URL must be set to the https:// API origin without a trailing slash');
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
