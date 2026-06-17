import express from 'express';

import { getActiveLoginMethod, isAdmin } from '#account-db';
import { secretsService } from '#services/secrets-service';
import {
  requestLoggerMiddleware,
  validateSessionMiddleware,
} from '#util/middlewares';

// Vite inlines this at build time so the HTML is available in the built bundle
import plaidLinkPageContent from './plaid-link-page.html?raw';
import { plaidService } from './plaid-service';
import { handleError } from './util/handle-error';

// Temporary storage for link tokens with 30-minute expiration
const linkTokenStore = new Map<
  string,
  { createdAt: number; expiresAt: number }
>();

const LINK_TOKEN_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes

// Server-side relay for post-Plaid-Link completion.
// The popup cannot postMessage back to the main app when COOP=same-origin is set
// on the Vite dev server (cross-BCG postMessage is dropped silently). Instead the
// popup calls /popup-complete (session-exempt, linkToken-authenticated) and the
// main app polls /popup-result (session-authenticated). The publicToken is held in
// memory only until the main app retrieves it (single-use, 5-minute TTL).
const pendingPopupCompletions = new Map<
  string,
  {
    publicToken: string;
    institutionId?: string;
    institutionName?: string;
    timestamp: number;
  }
>();

setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of pendingPopupCompletions) {
      if (now - val.timestamp > 5 * 60 * 1000) {
        pendingPopupCompletions.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

const app = express();

export { app as handlers };
app.use(express.json());
app.use(requestLoggerMiddleware);

// Skip session validation for unauthenticated Plaid popup / diagnostic routes.
// /popup-complete is called by the popup page (no session cookie); it uses
// the linkToken as its authentication credential instead.
const SESSION_EXEMPT_PATHS = new Set([
  '/link',
  '/test-link-sdk',
  '/debug-headers',
  '/link-sdk.js',
  '/popup-complete',
]);

const PLAID_SDK_URL = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
let cachedSdk: { content: string; fetchedAt: number } | null = null;
const SDK_CACHE_MS = 60 * 60 * 1000; // 1 hour

async function fetchPlaidSdk(): Promise<string> {
  const now = Date.now();
  if (cachedSdk && now - cachedSdk.fetchedAt < SDK_CACHE_MS) {
    return cachedSdk.content;
  }
  const response = await fetch(PLAID_SDK_URL);
  if (!response.ok) {
    throw new Error(`Plaid CDN returned ${response.status}`);
  }
  const content = await response.text();
  cachedSdk = { content, fetchedAt: now };
  return content;
}
app.use((req, res, next) => {
  if (SESSION_EXEMPT_PATHS.has(req.path)) {
    return next();
  }
  return validateSessionMiddleware(req, res, next);
});

// Plaid credentials are sensitive configuration; in OpenID mode only admins
// can manage them, otherwise any authenticated user can (single-user mode)
function canManagePlaidCredentials(userId: string | undefined): boolean {
  return (
    getActiveLoginMethod() !== 'openid' || (userId ? isAdmin(userId) : false)
  );
}

app.post('/status', async (req, res) => {
  const configured = plaidService.isConfigured();
  const env = secretsService.get('plaid_env');
  const clientId = secretsService.get('plaid_clientId');

  res.send({
    status: 'ok',
    data: {
      configured,
      ...(configured && {
        env,
        clientIdMasked: clientId
          ? `${clientId.substring(0, 4)}...${clientId.substring(clientId.length - 4)}`
          : undefined,
      }),
    },
  });
});

app.post(
  '/save-credentials',
  handleError(async (req, res) => {
    // Check authorization
    if (!canManagePlaidCredentials(res.locals.user_id)) {
      return res.status(403).send({
        status: 'error',
        reason: 'not-admin',
        details: 'You have to be admin to manage Plaid credentials',
      });
    }

    const { client_id, secret, env } = req.body || {};

    // Validate required fields
    if (!client_id || !secret || !env) {
      return res.status(400).send({
        status: 'error',
        reason: 'missing-required-fields',
        details: 'client_id, secret, and env are required',
      });
    }

    // Validate environment
    const validEnvs = ['sandbox', 'development', 'production'];
    if (!validEnvs.includes(env.toLowerCase())) {
      return res.status(400).send({
        status: 'error',
        reason: 'invalid-environment',
        details: 'env must be one of: sandbox, development, production',
      });
    }

    try {
      // Store credentials using secrets service
      secretsService.set('plaid_clientId', client_id);
      secretsService.set('plaid_secret', secret);
      secretsService.set('plaid_env', env.toLowerCase());

      // Verify they were stored correctly
      if (!plaidService.isConfigured()) {
        return res.status(500).send({
          status: 'error',
          reason: 'failed-to-store',
          details: 'Failed to store Plaid credentials',
        });
      }

      res.send({
        status: 'ok',
        data: {
          message: 'Plaid credentials saved successfully',
          configured: true,
          env: env.toLowerCase(),
        },
      });
    } catch (error) {
      const err = error as any;
      res.status(500).send({
        status: 'error',
        reason: 'storage-error',
        details: err?.message || 'Failed to store credentials',
      });
    }
  }),
);

app.post(
  '/clear-credentials',
  handleError(async (req, res) => {
    // Check authorization
    if (!canManagePlaidCredentials(res.locals.user_id)) {
      return res.status(403).send({
        status: 'error',
        reason: 'not-admin',
        details: 'You have to be admin to manage Plaid credentials',
      });
    }

    try {
      // Clear all Plaid credentials
      secretsService.set('plaid_clientId', '');
      secretsService.set('plaid_secret', '');
      secretsService.set('plaid_env', '');

      res.send({
        status: 'ok',
        data: {
          message: 'Plaid credentials cleared successfully',
          configured: false,
        },
      });
    } catch (error) {
      const err = error as any;
      res.status(500).send({
        status: 'error',
        reason: 'clear-error',
        details: err?.message || 'Failed to clear credentials',
      });
    }
  }),
);

app.post(
  '/create-link-token',
  handleError(async (req, res) => {
    const { userId, redirectUri } = req.body || {};

    if (!userId) {
      return res.status(400).send({
        status: 'error',
        reason: 'missing-user-id',
        details: 'userId is required',
      });
    }

    const linkToken = await plaidService.createLinkToken({
      userId,
      redirectUri,
    });

    // Store link token for popup validation (30-minute expiration)
    const now = Date.now();
    const expiresAt = now + LINK_TOKEN_EXPIRATION_MS;
    linkTokenStore.set(linkToken, { createdAt: now, expiresAt });
    console.log(
      '[Plaid] Stored link token for validation, expires at:',
      new Date(expiresAt).toISOString(),
    );

    res.send({
      status: 'ok',
      data: {
        linkToken,
      },
    });
  }),
);

app.post(
  '/exchange-public-token',
  handleError(async (req, res) => {
    const { publicToken, institutionId, institutionName } = req.body || {};
    console.log(
      '[Plaid] POST /exchange-public-token hit, publicToken present:',
      !!publicToken,
    );

    if (!publicToken) {
      return res.status(400).send({
        status: 'error',
        reason: 'missing-public-token',
        details: 'publicToken is required',
      });
    }

    const t0 = Date.now();
    const result = await plaidService.exchangePublicToken({
      publicToken,
      institutionId,
      institutionName,
    });
    console.log(
      '[Plaid] /exchange-public-token OK in',
      Date.now() - t0,
      'ms, itemId:',
      result.itemId,
    );

    res.send({ status: 'ok', data: result });
  }),
);

app.post(
  '/get-plaid-accounts',
  handleError(async (req, res) => {
    const { itemId } = req.body || {};
    console.log(
      '[Plaid] POST /get-plaid-accounts hit, itemId:',
      itemId ?? '(missing)',
    );

    if (!itemId) {
      return res.status(400).send({
        status: 'error',
        reason: 'missing-item-id',
        details: 'itemId is required',
      });
    }

    const t0 = Date.now();
    const accounts = await plaidService.getPlaidAccounts(itemId);
    console.log(
      '[Plaid] /get-plaid-accounts OK in',
      Date.now() - t0,
      'ms, accounts:',
      accounts.length,
    );

    res.send({ status: 'ok', data: { accounts } });
  }),
);

app.post(
  '/get-transactions',
  handleError(async (req, res) => {
    const { itemId, accountId } = req.body || {};

    if (!itemId) {
      return res.status(400).send({
        status: 'error',
        reason: 'missing-item-id',
        details: 'itemId is required',
      });
    }

    const result = await plaidService.getTransactions(itemId, accountId);

    res.send({
      status: 'ok',
      data: result,
    });
  }),
);

app.post(
  '/sync-plaid-transactions',
  handleError(async (req, res) => {
    const { itemId, accountId } = req.body || {};

    if (!itemId) {
      return res.status(400).send({
        status: 'error',
        reason: 'missing-item-id',
        details: 'itemId is required',
      });
    }

    const result = await plaidService.syncTransactions(itemId, accountId);

    res.send({
      status: 'ok',
      data: result,
    });
  }),
);

// Called by the popup (session-exempt) after Plaid onSuccess. The linkToken
// proves the call is from a legitimate Plaid flow started by this server.
// publicToken is stored transiently for the main app to retrieve via /popup-result.
app.post(
  '/popup-complete',
  handleError(async (req, res) => {
    const { linkToken, publicToken, institutionId, institutionName } =
      req.body || {};

    if (!linkToken || !publicToken) {
      return res
        .status(400)
        .send({ status: 'error', reason: 'missing-fields' });
    }

    const tokenData = linkTokenStore.get(linkToken);
    if (!tokenData || Date.now() > tokenData.expiresAt) {
      linkTokenStore.delete(linkToken);
      return res.status(401).send({
        status: 'error',
        reason: 'unauthorized',
        details: 'invalid-or-expired-link-token',
      });
    }

    pendingPopupCompletions.set(linkToken, {
      publicToken,
      institutionId: institutionId || undefined,
      institutionName: institutionName || undefined,
      timestamp: Date.now(),
    });
    console.log(
      '[Plaid] /popup-complete: stored relay for linkToken (first 20):',
      linkToken.substring(0, 20),
    );

    res.send({ status: 'ok' });
  }),
);

// Polled by the authenticated main app to retrieve the popup result.
// Returns { pending: true } while waiting, or the publicToken data once available.
// The entry is deleted after retrieval (single-use).
app.post(
  '/popup-result',
  handleError(async (req, res) => {
    const { linkToken } = req.body || {};
    if (!linkToken) {
      return res
        .status(400)
        .send({ status: 'error', reason: 'missing-link-token' });
    }

    const completion = pendingPopupCompletions.get(linkToken);
    if (!completion) {
      return res.send({ status: 'ok', data: { pending: true } });
    }

    pendingPopupCompletions.delete(linkToken);
    console.log(
      '[Plaid] /popup-result: returning relay result for linkToken (first 20):',
      linkToken.substring(0, 20),
    );

    return res.send({
      status: 'ok',
      data: {
        pending: false,
        publicToken: completion.publicToken,
        institutionId: completion.institutionId,
        institutionName: completion.institutionName,
      },
    });
  }),
);

// Returns all stored Plaid items (no access_token) for debugging connection-limit issues.
app.get(
  '/debug/items',
  handleError(async (_req, res) => {
    const items = plaidService.listItems();
    console.log('[Plaid] /debug/items: returning', items.length, 'item(s)');
    res.send({ status: 'ok', data: { items, totalItems: items.length } });
  }),
);

// Calls Plaid itemRemove and deletes local DB records.
// Use this to clean up items accumulated during testing.
app.post(
  '/remove-item',
  handleError(async (req, res) => {
    const { itemId } = req.body || {};
    if (!itemId) {
      return res
        .status(400)
        .send({ status: 'error', reason: 'missing-item-id' });
    }
    await plaidService.removeItem(itemId);
    res.send({ status: 'ok', data: { removed: itemId } });
  }),
);

// Serve Plaid Link page without session validation
// The link_token in the query parameter provides the security boundary
app.get('/link', (req, res) => {
  const linkToken = req.query.link_token as string | undefined;

  if (!linkToken) {
    console.error('[Plaid] /link: missing link_token query parameter');
    return res.status(400).send({
      status: 'error',
      reason: 'missing-link-token',
      details: 'link_token query parameter is required',
    });
  }

  // Validate the link token
  const tokenData = linkTokenStore.get(linkToken);
  if (!tokenData) {
    console.error(
      '[Plaid] /link: link_token not found in store:',
      linkToken.substring(0, 20) + '...',
    );
    return res.status(401).send({
      status: 'error',
      reason: 'unauthorized',
      details: 'token-not-found',
    });
  }

  // Check if token is expired
  const now = Date.now();
  if (now > tokenData.expiresAt) {
    console.error('[Plaid] /link: link_token expired');
    linkTokenStore.delete(linkToken);
    return res.status(401).send({
      status: 'error',
      reason: 'unauthorized',
      details: 'token-expired',
    });
  }

  console.log('[Plaid] /link: link_token validated, serving Plaid Link page');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(plaidLinkPageContent);
});

// Serve Plaid Link SDK from same origin to avoid ORB/COEP/CORS issues with the CDN.
// Cached in memory for 1 hour so the CDN is only hit once per server restart.
// Must be in PLAID_POPUP_PATHS (app.ts) and SESSION_EXEMPT_PATHS above.
app.get('/link-sdk.js', async (_req, res) => {
  try {
    const sdk = await fetchPlaidSdk();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(sdk);
  } catch (err) {
    const e = err as Error;
    console.error('[Plaid] Failed to fetch Plaid SDK from CDN:', e.message);
    res.status(502).send(`// Failed to fetch Plaid SDK: ${e.message}`);
  }
});

// TEMPORARY DIAGNOSTIC: confirms which security headers this route receives.
// Useful to verify that /plaid/link has no COEP while /plaid/debug-headers has it.
// Remove once Plaid Link is confirmed working.
app.get('/debug-headers', (_req, res) => {
  res.json({
    outgoingHeaders: {
      'Content-Security-Policy': res.get('Content-Security-Policy') ?? null,
      'Cross-Origin-Embedder-Policy':
        res.get('Cross-Origin-Embedder-Policy') ?? null,
      'Cross-Origin-Opener-Policy':
        res.get('Cross-Origin-Opener-Policy') ?? null,
      'Cross-Origin-Resource-Policy':
        res.get('Cross-Origin-Resource-Policy') ?? null,
    },
    note: 'This route (/plaid/debug-headers) uses main-app headers — COEP should be require-corp here. Visit /plaid/link and /plaid/test-link-sdk in Network tab to confirm those have NO COEP.',
  });
});

// TEMPORARY DIAGNOSTIC: tests Plaid CDN loading with detailed browser diagnostics.
// Shows exact fetch status, onerror reason, and CSP violations to pinpoint the blocker.
// Remove once Plaid Link is confirmed working.
app.get('/test-link-sdk', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Plaid SDK Test</title>
<style>
  body { font-family: monospace; padding: 16px; background: #f5f5f5; }
  .ok { color: #2a6; }
  .fail { color: #c33; font-weight: bold; }
  .info { color: #555; }
  pre { background: #fff; padding: 8px; border: 1px solid #ccc; white-space: pre-wrap; word-break: break-all; }
</style>
</head>
<body>
<h3>Plaid SDK Diagnostic</h3>
<div id="log"></div>
<script>
  var CDN_URL = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
  var log = document.getElementById('log');

  function line(cls, text) {
    var p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    log.appendChild(p);
  }
  function pre(text) {
    var el = document.createElement('pre');
    el.textContent = text;
    log.appendChild(el);
  }

  // 1. Show this page's response headers (from a fetch to self)
  fetch(window.location.href, { method: 'HEAD' })
    .then(function(r) {
      var h = '';
      r.headers.forEach(function(v, k) { h += k + ': ' + v + '\\n'; });
      line('info', '--- Response headers for THIS page ---');
      pre(h || '(none visible)');
    }).catch(function(){});

  // 2. Check CDN reachability with a CORS fetch (will show exact status or CORS error)
  line('info', '--- Checking CDN with fetch(mode:cors) ---');
  fetch(CDN_URL, { mode: 'cors' })
    .then(function(r) {
      line('ok', 'fetch CORS status: ' + r.status + ' content-type: ' + r.headers.get('content-type'));
    })
    .catch(function(e) {
      line('fail', 'fetch CORS error: ' + e.message + ' (CORS headers missing from CDN response, or network error)');
    });

  // 3. Check CDN reachability with no-cors (opaque = reached, error = network fail)
  line('info', '--- Checking CDN with fetch(mode:no-cors) ---');
  fetch(CDN_URL, { mode: 'no-cors' })
    .then(function(r) {
      line('ok', 'fetch no-cors response type: ' + r.type + ' (opaque = CDN reached, status hidden)');
    })
    .catch(function(e) {
      line('fail', 'fetch no-cors failed: ' + e.message + ' (CDN unreachable - DNS/TLS/network failure)');
    });

  // 4. CSP violation listener
  document.addEventListener('securitypolicyviolation', function(e) {
    line('fail', 'CSP violation: ' + e.violatedDirective + ' blocked ' + e.blockedURI);
  });

  // 5. Try loading the script from the same-origin proxy (avoids CDN ORB/COEP entirely)
  line('info', '--- Loading Plaid SDK via /plaid/link-sdk.js (same-origin proxy) ---');
  var script = document.createElement('script');
  script.src = '/plaid/link-sdk.js';
  script.onload = function() {
    if (typeof window.Plaid !== 'undefined') {
      line('ok', 'SUCCESS: window.Plaid loaded! type=' + typeof window.Plaid);
    } else {
      line('fail', 'Script onload fired but window.Plaid is undefined (SDK loaded but did not define Plaid)');
    }
  };
  script.onerror = function(e) {
    line('fail', 'Script onerror: CDN script failed to load');
    line('fail', '  Check Network tab for cdn.plaid.com - look at status code and blocking reason');
    line('info', '  If status=403 with application/xml: CDN is blocking this browser/IP');
    line('info', '  If blocked by OpaqueResponseBlocking: COEP is set or MIME type wrong');
    pre('event type: ' + (e && e.type) + '\\nevent target.src: ' + (e && e.target && e.target.src));
  };
  document.head.appendChild(script);
</script>
</body>
</html>`);
});
