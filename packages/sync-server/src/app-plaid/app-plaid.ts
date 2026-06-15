import path from 'path';

import express from 'express';

import {
  requestLoggerMiddleware,
  validateSessionMiddleware,
} from '#util/middlewares';

import { plaidService } from './plaid-service';
import { handleError } from './util/handle-error';

const app = express();
app.use(requestLoggerMiddleware);

export { app as handlers };
app.use(express.json());
app.use(validateSessionMiddleware);

app.post('/status', async (req, res) => {
  res.send({
    status: 'ok',
    data: {
      configured: plaidService.isConfigured(),
    },
  });
});

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

    // Placeholder for full transaction sync implementation
    const result = await plaidService.syncTransactions(itemId, accountId);

    res.send({
      status: 'ok',
      data: result,
    });
  }),
);
