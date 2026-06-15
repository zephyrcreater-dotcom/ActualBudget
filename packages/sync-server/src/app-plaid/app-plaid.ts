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

const app = express();

export { app as handlers };
app.use(express.json());
app.use(requestLoggerMiddleware);

// Skip session validation for unauthenticated Plaid popup / diagnostic routes
const SESSION_EXEMPT_PATHS = new Set([
  '/link',
  '/test-link-sdk',
  '/debug-headers',
]);
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

    if (!publicToken) {
      return res.status(400).send({
        status: 'error',
        reason: 'missing-public-token',
        details: 'publicToken is required',
      });
    }

    const result = await plaidService.exchangePublicToken({
      publicToken,
      institutionId,
      institutionName,
    });

    res.send({
      status: 'ok',
      data: result,
    });
  }),
);

app.post(
  '/get-plaid-accounts',
  handleError(async (req, res) => {
    const { itemId } = req.body || {};

    if (!itemId) {
      return res.status(400).send({
        status: 'error',
        reason: 'missing-item-id',
        details: 'itemId is required',
      });
    }

    const accounts = await plaidService.getPlaidAccounts(itemId);

    res.send({
      status: 'ok',
      data: {
        accounts,
      },
    });
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

// TEMPORARY DIAGNOSTIC: bare minimum HTML to test whether Plaid CDN script
// loads in a context with no COEP/COOP. Should show "Plaid loaded" if headers
// are correct. Remove once Plaid Link is confirmed working.
app.get('/test-link-sdk', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Plaid SDK Test</title></head>
<body>
<p id="status">Loading...</p>
<script src="https://cdn.plaid.com/link/v3/stable/link-initialize.js"></script>
<script>
  document.getElementById('status').textContent =
    typeof window.Plaid !== 'undefined' ? 'Plaid loaded' : 'Plaid missing (window.Plaid is undefined)';
</script>
</body>
</html>`);
});
