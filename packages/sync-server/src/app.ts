import fs, { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';

import { bootstrap } from './account-db';
import * as accountApp from './app-account';
import * as adminApp from './app-admin';
import * as akahuApp from './app-akahu/app-akahu.js';
import * as corsApp from './app-cors-proxy';
import * as enableBankingApp from './app-enablebanking/app-enablebanking';
import * as goCardlessApp from './app-gocardless/app-gocardless';
import * as openidApp from './app-openid';
import * as plaidApp from './app-plaid/app-plaid';
import * as pluggai from './app-pluggyai/app-pluggyai';
import * as secretApp from './app-secrets';
import * as simpleFinApp from './app-simplefin/app-simplefin';
import * as syncApp from './app-sync';
import { config } from './load-config';

const app = express();

process.on('unhandledRejection', reason => {
  console.log('Rejection:', reason);
});

app.disable('x-powered-by');
app.use(cors());
app.set('trust proxy', config.get('trustedProxies'));
if (process.env.NODE_ENV !== 'development') {
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 500,
      legacyHeaders: false,
      standardHeaders: true,
    }),
  );
}

app.use(express.json({ limit: `${config.get('upload.fileSizeLimitMB')}mb` }));

app.use(
  express.raw({
    type: 'application/actual-sync',
    limit: `${config.get('upload.fileSizeSyncLimitMB')}mb`,
  }),
);

app.use(
  express.raw({
    type: 'application/encrypted-file',
    limit: `${config.get('upload.syncEncryptedFileSizeLimitMB')}mb`,
  }),
);

// Security headers must be applied BEFORE route handlers so that the response
// object already carries the correct headers when the route handler calls
// res.send(). Middleware registered after a route handler is never reached for
// that route.
const isDev = process.env.NODE_ENV === 'development';
const scriptSrc = isDev
  ? "'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdn.plaid.com"
  : "'self' 'unsafe-eval' blob: https://cdn.plaid.com";
const connectSrc = isDev
  ? "'self' ws: wss: http: https: https://production.plaid.com https://sandbox.plaid.com https://development.plaid.com"
  : "'self' http: https: https://production.plaid.com https://sandbox.plaid.com https://development.plaid.com";
const csp = [
  "default-src 'self' blob:",
  "img-src 'self' blob: data:",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "frame-src 'self' https://cdn.plaid.com",
].join('; ');

// Popup-only CSP: allows Plaid CDN + *.plaid.com subdomains; no COEP/COOP so
// the Plaid Link SDK (which doesn't send CORP headers) can load from the CDN.
const plaidPopupCsp = [
  "default-src 'self'",
  "img-src 'self' data: https://*.plaid.com",
  "script-src 'self' 'unsafe-inline' https://cdn.plaid.com",
  "style-src 'self' 'unsafe-inline' https://cdn.plaid.com",
  "connect-src 'self' https://*.plaid.com",
  "frame-src 'self' https://cdn.plaid.com https://*.plaid.com",
].join('; ');

// Routes that serve the Plaid Link popup or test pages must not have COEP/COOP
// because Plaid's CDN does not send Cross-Origin-Resource-Policy headers.
// Any path added here must also be added to the session-skip list in app-plaid.ts.
const PLAID_POPUP_PATHS = new Set(['/plaid/link', '/plaid/test-link-sdk']);

app.use((req, res, next) => {
  if (PLAID_POPUP_PATHS.has(req.path)) {
    // Popup pages: strip isolation headers so Plaid CDN resources can load.
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.set('Content-Security-Policy', plaidPopupCsp);
  } else {
    res.set('Cross-Origin-Opener-Policy', 'same-origin');
    res.set('Cross-Origin-Embedder-Policy', 'require-corp');
    res.set('Content-Security-Policy', csp);
  }
  next();
});

app.use('/sync', syncApp.handlers);
app.use('/account', accountApp.handlers);
app.use('/gocardless', goCardlessApp.handlers);
app.use('/simplefin', simpleFinApp.handlers);
app.use('/pluggyai', pluggai.handlers);
app.use('/akahu', akahuApp.handlers);
app.use('/enablebanking', enableBankingApp.handlers);
app.use('/plaid', plaidApp.handlers);
app.use('/secret', secretApp.handlers);

if (config.get('corsProxy.enabled')) {
  app.use('/cors-proxy', corsApp.handlers);
}

app.use('/admin', adminApp.handlers);
app.use('/openid', openidApp.handlers);

app.get('/mode', (req, res) => {
  res.send(config.get('mode'));
});

app.get('/info', (_req, res) => {
  function findPackageJson(startDir: string) {
    // find the nearest package.json file while traversing up the directory tree
    let currentPath = startDir;
    let directoriesSearched = 0;
    const pathRoot = resolve(currentPath, '/');
    try {
      while (currentPath !== pathRoot && directoriesSearched < 5) {
        const packageJsonPath = resolve(currentPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(
            readFileSync(packageJsonPath, 'utf-8'),
          );

          if (packageJson.name === '@actual-app/sync-server') {
            return packageJson;
          }
        }

        currentPath = resolve(join(currentPath, '..')); // Move up one directory
        directoriesSearched++;
      }
    } catch (error) {
      console.error('Error while searching for package.json:', error);
    }

    return null;
  }

  const dirname = resolve(fileURLToPath(import.meta.url), '../');
  const packageJson = findPackageJson(dirname);

  res.status(200).json({
    build: {
      name: packageJson?.name,
      description: packageJson?.description,
      version: packageJson?.version,
    },
  });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'UP' });
});

app.get('/metrics', (_req, res) => {
  res.status(200).json({
    mem: process.memoryUsage(),
    uptime: process.uptime(),
  });
});

// Dev mode proxies to Vite. Prod serves the static React app.
if (isDev) {
  console.log(
    'Running in development mode - Proxying frontend routes to React Dev Server',
  );

  // Imported within Dev block to allow dev dependency in package.json (reduces package size in production)
  const httpProxyMiddleware = await import('http-proxy-middleware');

  app.use(
    httpProxyMiddleware.createProxyMiddleware({
      target: 'http://localhost:3001',
      changeOrigin: true,
      ws: true,
    }),
  );
} else {
  console.log('Running in production mode - Serving static React app');

  app.use(express.static(config.get('webRoot'), { index: false }));
  app.get('/{*splat}', (req, res) =>
    res.sendFile('index.html', { root: config.get('webRoot') }),
  );
}

function parseHTTPSConfig(value: string) {
  if (value.startsWith('-----BEGIN')) {
    return value;
  }
  return fs.readFileSync(value);
}

function sendServerStartedMessage() {
  // Signify to any parent process that the server has started. Used in electron desktop app
  // oxlint-disable-next-line typescript/ban-ts-comment
  // @ts-ignore-error electron types
  process.parentPort?.postMessage({ type: 'server-started' });
  console.log(
    'Listening on ' + config.get('hostname') + ':' + config.get('port') + '...',
  );
}

export async function run() {
  const portVal = config.get('port');
  const port = typeof portVal === 'string' ? parseInt(portVal) : portVal;
  const hostname = config.get('hostname');
  const openIdConfig = config?.getProperties()?.openId;
  if (
    openIdConfig?.discoveryURL ||
    openIdConfig?.issuer?.authorization_endpoint
  ) {
    console.log('OpenID configuration found. Preparing server to use it');
    try {
      const result = await bootstrap({ openId: openIdConfig }, true);
      if ('error' in result && result.error) {
        console.log(result.error);
      } else {
        console.log('OpenID configured!');
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (config.get('https.key') && config.get('https.cert')) {
    const https = await import('node:https');
    const httpsOptions = {
      ...config.get('https'),
      key: parseHTTPSConfig(config.get('https.key')),
      cert: parseHTTPSConfig(config.get('https.cert')),
    };
    https.createServer(httpsOptions, app).listen(port, hostname, () => {
      sendServerStartedMessage();
    });
  } else {
    app.listen(port, hostname, () => {
      sendServerStartedMessage();
    });
  }
}
