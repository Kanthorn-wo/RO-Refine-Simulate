import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dev-only: รัน serverless function /api/* ภายใต้ vite dev server
// (production ใช้ Vercel function จริง — plugin นี้ apply: 'serve' เท่านั้น ไม่กระทบ build)
function devApiPlugin() {
  const routes = { '/api/ga': './api/ga.js', '/api/item': './api/item.js', '/api/monitor': './api/monitor.js' };
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url ? req.url.split('?')[0] : '';
        const mod = routes[path];
        if (!mod) return next();
        try {
          const { default: handler } = await import(mod);
          // shim ให้ res มี .status()/.json()/.setHeader() แบบ Vercel
          const shim = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            setHeader(k, v) { res.setHeader(k, v); return this; },
            json(obj) {
              res.statusCode = this.statusCode;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify(obj));
              return this;
            },
          };
          await handler(req, shim);
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e?.message || 'dev api error' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // โหลด env ทั้งหมด (รวมตัวที่ไม่ขึ้นต้น VITE_) ให้ dev api handler อ่าน process.env ได้
  const env = loadEnv(mode, process.cwd(), '');
  for (const k of ['GA_PROPERTY_ID', 'GA_CLIENT_EMAIL', 'GA_PRIVATE_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'DASHBOARD_ALLOWED_EMAILS', 'DIVINE_PRIDE_API_KEY']) {
    if (env[k]) process.env[k] = env[k];
  }

  return {
    plugins: [react(), tailwindcss(), devApiPlugin()],
    resolve: {
      alias: {
        assets: path.resolve(__dirname, 'src/assets'),
      },
    },
    build: {
      rollupOptions: {
        // Multi-page: Thai at /, English at /en/ (same app, different static SEO meta)
        input: {
          main: path.resolve(__dirname, 'index.html'),
          en: path.resolve(__dirname, 'en/index.html'),
        },
      },
    },
  };
})
