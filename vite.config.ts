import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { Readable } from 'node:stream';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Menjalankan api/index.ts (Hono) di dalam dev server Vite agar /api/* bisa
// dites tanpa `vercel dev`. Route tetap bersumber dari api/index.ts, bukan
// diduplikasi di sini. Hanya aktif pada `npm run dev`.
function apiDevServer(env: Record<string, string>): Plugin {
  return {
    name: 'buku-po:api-dev-server',
    async configureServer(server) {
      if (!process.env.NEON_DATABASE_URL && env.NEON_DATABASE_URL) {
        process.env.NEON_DATABASE_URL = env.NEON_DATABASE_URL;
      }

      const { default: handler } = await import('./api/index');
      const fetchHandler = handler as (request: Request) => Response | Promise<Response>;

      // Ditambahkan sebelum middleware internal Vite, agar /api/* tidak
      // tertangkap oleh SPA fallback.
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api')) {
          next();
          return;
        }

        try {
          const init: RequestInit = {
            method: req.method,
            headers: req.headers as Record<string, string>,
          };

          if (req.method !== 'GET' && req.method !== 'HEAD') {
            Object.assign(init, { body: Readable.toWeb(req), duplex: 'half' });
          }

          const response = await fetchHandler(
            new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, init)
          );

          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));

          if (!response.body) {
            res.end();
            return;
          }

          Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
        } catch (err) {
          server.config.logger.error(`[api] ${err instanceof Error ? err.stack : String(err)}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
          }
          res.end(JSON.stringify({ error: 'API dev server error' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), apiDevServer(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env': JSON.stringify(env)
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
    },
    server: {
      port: 3000,
      host: true,
      hmr: false
    }
  };
});
