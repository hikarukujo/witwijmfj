import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import locationRouter from './routes/location.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildPath = path.join(__dirname, '..', 'build');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://www.googletagmanager.com', "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          'data:',
          'https://*.tile.openstreetmap.org',
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", 'https://www.google-analytics.com'],
        fontSrc: ["'self'", 'data:'],
        frameAncestors: ["'none'"],
      },
    },
  }),
);

app.use(compression());

app.use('/api', locationRouter);

app.use(
  express.static(buildPath, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

// 404 for unmatched /api/*; SPA fallback for everything else.
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));
app.use((req, res) => res.sendFile(path.join(buildPath, 'index.html')));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`witwijmfj listening on :${port}`);
});
