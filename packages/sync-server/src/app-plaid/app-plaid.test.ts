import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handlers as app } from './app-plaid';

vi.mock('./plaid-service', () => ({
  plaidService: {
    isConfigured: vi.fn(() => true),
    createLinkToken: vi.fn(),
    exchangePublicToken: vi.fn(),
    getPlaidAccounts: vi.fn(),
    getTransactions: vi.fn(),
    syncTransactions: vi.fn(),
  },
}));

vi.mock('#util/middlewares', () => ({
  requestLoggerMiddleware: (req: any, res: any, next: any) => next(),
  validateSessionMiddleware: (req: any, res: any, next: any) => {
    res.locals = { user_id: 'test-user' };
    next();
  },
}));

vi.mock('#services/secrets-service', () => ({
  secretsService: {
    get: vi.fn((name: string) => {
      switch (name) {
        case 'plaid_clientId':
          return 'test_client_id_12345';
        case 'plaid_secret':
          return 'test_secret_key';
        case 'plaid_env':
          return 'sandbox';
        default:
          return null;
      }
    }),
    set: vi.fn(),
    exists: vi.fn((name: string) => {
      return ['plaid_clientId', 'plaid_secret', 'plaid_env'].includes(name);
    }),
  },
}));

vi.mock('#account-db', () => ({
  getActiveLoginMethod: vi.fn(() => 'password'), // Allow non-admin in non-OpenID mode
  isAdmin: vi.fn((userId: string) => userId === 'admin-user'),
}));

import { getActiveLoginMethod, isAdmin } from '#account-db';
import { secretsService } from '#services/secrets-service';

// Import after mocks are set up
import { plaidService } from './plaid-service';

describe('Plaid API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /plaid/status', () => {
    it('returns configured status', async () => {
      const response = await request(app).post('/status');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.data).toHaveProperty('configured');
      expect(typeof response.body.data.configured).toBe('boolean');
    });
  });

  describe('POST /plaid/create-link-token', () => {
    it('returns 400 when userId is missing', async () => {
      const response = await request(app).post('/create-link-token').send({});

      expect(response.status).toBe(400);
      expect(response.body.reason).toBe('missing-user-id');
    });

    it('successfully creates a link token', async () => {
      const mockLinkToken = 'link_token_test_123';
      (plaidService.createLinkToken as any).mockResolvedValue(mockLinkToken);

      const response = await request(app).post('/create-link-token').send({
        userId: 'user123',
      });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.data.linkToken).toBe(mockLinkToken);
    });

    it('includes redirect URI when provided', async () => {
      const mockLinkToken = 'link_token_test_123';
      (plaidService.createLinkToken as any).mockResolvedValue(mockLinkToken);

      const response = await request(app).post('/create-link-token').send({
        userId: 'user123',
        redirectUri: 'https://example.com/callback',
      });

      expect(response.status).toBe(200);
      expect(plaidService.createLinkToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          redirectUri: 'https://example.com/callback',
        }),
      );
    });

    it('returns 500 on Plaid API error', async () => {
      (plaidService.createLinkToken as any).mockRejectedValue(
        new Error('Plaid API error'),
      );

      const response = await request(app).post('/create-link-token').send({
        userId: 'user123',
      });

      expect(response.status).toBe(500);
      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /plaid/exchange-public-token', () => {
    it('returns 400 when publicToken is missing', async () => {
      const response = await request(app)
        .post('/exchange-public-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.reason).toBe('missing-public-token');
    });

    it('successfully exchanges public token', async () => {
      const mockResult = {
        itemId: 'item_test_123',
        institutionId: 'ins_123',
        institutionName: 'Chase Bank',
        status: 'active',
      };

      (plaidService.exchangePublicToken as any).mockResolvedValue(mockResult);

      const response = await request(app).post('/exchange-public-token').send({
        publicToken: 'public_token_123',
        institutionId: 'ins_123',
        institutionName: 'Chase Bank',
      });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.data).toEqual(mockResult);
    });

    it('does not expose access token in response', async () => {
      const mockResult = {
        itemId: 'item_test_123',
        institutionId: 'ins_123',
        institutionName: 'Chase Bank',
        status: 'active',
      };

      (plaidService.exchangePublicToken as any).mockResolvedValue(mockResult);

      const response = await request(app).post('/exchange-public-token').send({
        publicToken: 'public_token_123',
      });

      expect(response.status).toBe(200);
      const responseBody = JSON.stringify(response.body);
      expect(responseBody).not.toContain('access_token');
      expect(responseBody).not.toContain('accessToken');
    });

    it('returns 500 on Plaid API error', async () => {
      (plaidService.exchangePublicToken as any).mockRejectedValue(
        new Error('Plaid API error'),
      );

      const response = await request(app).post('/exchange-public-token').send({
        publicToken: 'public_token_123',
      });

      expect(response.status).toBe(500);
      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /plaid/get-plaid-accounts', () => {
    it('returns 400 when itemId is missing', async () => {
      const response = await request(app).post('/get-plaid-accounts').send({});

      expect(response.status).toBe(400);
      expect(response.body.reason).toBe('missing-item-id');
    });

    it('successfully fetches accounts', async () => {
      const mockAccounts = [
        {
          plaidAccountId: 'account_test_123',
          itemId: 'item_test_123',
          mask: '1234',
          name: 'Checking',
          officialName: 'Chase Checking Account',
          subtype: 'checking',
          type: 'depository',
        },
      ];

      (plaidService.getPlaidAccounts as any).mockResolvedValue(mockAccounts);

      const response = await request(app).post('/get-plaid-accounts').send({
        itemId: 'item_test_123',
      });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.data.accounts).toEqual(mockAccounts);
    });

    it('does not expose access token in response', async () => {
      const mockAccounts = [
        {
          plaidAccountId: 'account_test_123',
          itemId: 'item_test_123',
          mask: '1234',
          name: 'Checking',
          officialName: 'Chase Checking Account',
          subtype: 'checking',
          type: 'depository',
        },
      ];

      (plaidService.getPlaidAccounts as any).mockResolvedValue(mockAccounts);

      const response = await request(app).post('/get-plaid-accounts').send({
        itemId: 'item_test_123',
      });

      expect(response.status).toBe(200);
      const responseBody = JSON.stringify(response.body);
      expect(responseBody).not.toContain('access_token');
      expect(responseBody).not.toContain('accessToken');
    });

    it('returns 500 on Plaid API error', async () => {
      (plaidService.getPlaidAccounts as any).mockRejectedValue(
        new Error('Plaid API error'),
      );

      const response = await request(app).post('/get-plaid-accounts').send({
        itemId: 'item_test_123',
      });

      expect(response.status).toBe(500);
      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /plaid/get-transactions', () => {
    it('returns 400 when itemId is missing', async () => {
      const response = await request(app).post('/get-transactions').send({});

      expect(response.status).toBe(400);
      expect(response.body.reason).toBe('missing-item-id');
    });

    it('successfully fetches transactions', async () => {
      const mockTransactions = {
        transactions: [
          {
            transactionId: 'txn_123',
            amount: '-50.00',
            transactionAmount: { amount: '-50.00', currency: 'USD' },
            payeeName: 'Amazon',
            date: '2026-06-15',
            booked: true,
            account: 'account_test_123',
            imported_id: 'txn_123',
          },
          {
            transactionId: 'txn_124',
            amount: '-25.50',
            transactionAmount: { amount: '-25.50', currency: 'USD' },
            payeeName: 'Coffee Shop',
            date: '2026-06-14',
            booked: false,
            account: 'account_test_123',
            imported_id: 'txn_124',
          },
        ],
        accountBalance: [],
        startingBalance: 0,
      };

      (plaidService.getTransactions as any).mockResolvedValue(mockTransactions);

      const response = await request(app).post('/get-transactions').send({
        itemId: 'item_test_123',
      });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.data.transactions).toHaveLength(2);
      expect(response.body.data.transactions[0].payeeName).toBe('Amazon');
    });

    it('supports optional accountId parameter', async () => {
      const mockTransactions = {
        transactions: [],
        accountBalance: [],
        startingBalance: 0,
      };

      (plaidService.getTransactions as any).mockResolvedValue(mockTransactions);

      const response = await request(app).post('/get-transactions').send({
        itemId: 'item_test_123',
        accountId: 'account_test_123',
      });

      expect(response.status).toBe(200);
      expect(plaidService.getTransactions).toHaveBeenCalledWith(
        'item_test_123',
        'account_test_123',
      );
    });

    it('does not expose access token in response', async () => {
      const mockTransactions = {
        transactions: [],
        accountBalance: [],
        startingBalance: 0,
      };

      (plaidService.getTransactions as any).mockResolvedValue(mockTransactions);

      const response = await request(app).post('/get-transactions').send({
        itemId: 'item_test_123',
      });

      expect(response.status).toBe(200);
      const responseBody = JSON.stringify(response.body);
      expect(responseBody).not.toContain('access_token');
      expect(responseBody).not.toContain('accessToken');
    });

    it('returns 500 on error', async () => {
      (plaidService.getTransactions as any).mockRejectedValue(
        new Error('Transaction fetch error'),
      );

      const response = await request(app).post('/get-transactions').send({
        itemId: 'item_test_123',
      });

      expect(response.status).toBe(500);
      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /plaid/sync-plaid-transactions', () => {
    it('returns 400 when itemId is missing', async () => {
      const response = await request(app)
        .post('/sync-plaid-transactions')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.reason).toBe('missing-item-id');
    });

    it('successfully syncs transactions (placeholder)', async () => {
      const mockResult = {
        synced: true,
        message:
          'Plaid transaction sync placeholder. Ready for loot-core integration.',
      };

      (plaidService.syncTransactions as any).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/sync-plaid-transactions')
        .send({
          itemId: 'item_test_123',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.data.synced).toBe(true);
    });

    it('supports optional accountId parameter', async () => {
      const mockResult = {
        synced: true,
        message: 'Placeholder',
      };

      (plaidService.syncTransactions as any).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/sync-plaid-transactions')
        .send({
          itemId: 'item_test_123',
          accountId: 'account_test_123',
        });

      expect(response.status).toBe(200);
      expect(plaidService.syncTransactions).toHaveBeenCalledWith(
        'item_test_123',
        'account_test_123',
      );
    });

    it('does not expose access token in response', async () => {
      const mockResult = {
        synced: true,
        message: 'Placeholder',
      };

      (plaidService.syncTransactions as any).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/sync-plaid-transactions')
        .send({
          itemId: 'item_test_123',
        });

      expect(response.status).toBe(200);
      const responseBody = JSON.stringify(response.body);
      expect(responseBody).not.toContain('access_token');
      expect(responseBody).not.toContain('accessToken');
    });

    it('returns 500 on error', async () => {
      (plaidService.syncTransactions as any).mockRejectedValue(
        new Error('Sync error'),
      );

      const response = await request(app)
        .post('/sync-plaid-transactions')
        .send({
          itemId: 'item_test_123',
        });

      expect(response.status).toBe(500);
      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /plaid/save-credentials', () => {
    beforeEach(() => {
      // Set to OpenID mode to require admin check
      vi.mocked(getActiveLoginMethod).mockReturnValue('openid');
      // Default to non-admin user (unauthorized)
      vi.mocked(isAdmin).mockReturnValue(false);
    });

    it('returns 403 when user is not admin', async () => {
      const response = await request(app).post('/save-credentials').send({
        client_id: 'pk_live_12345',
        secret: 'my_secret_key',
        env: 'sandbox',
      });

      expect(response.status).toBe(403);
      expect(response.body.reason).toBe('not-admin');
    });

    it('returns 400 when required fields are missing', async () => {
      // Set user as admin for this test
      vi.mocked(isAdmin).mockReturnValue(true);

      const response = await request(app).post('/save-credentials').send({
        client_id: 'client_123',
      });

      expect(response.status).toBe(400);
      expect(response.body.reason).toBe('missing-required-fields');
    });

    it('returns 400 for invalid environment', async () => {
      vi.mocked(isAdmin).mockReturnValue(true);

      const response = await request(app).post('/save-credentials').send({
        client_id: 'client_123',
        secret: 'secret_key',
        env: 'invalid-env',
      });

      expect(response.status).toBe(400);
      expect(response.body.reason).toBe('invalid-environment');
    });

    it('successfully saves credentials', async () => {
      vi.mocked(isAdmin).mockReturnValue(true);
      (secretsService.set as any).mockReturnValue({ changes: 1 });
      (plaidService.isConfigured as any).mockReturnValue(true);

      const response = await request(app).post('/save-credentials').send({
        client_id: 'pk_live_12345',
        secret: 'my_secret_key',
        env: 'sandbox',
      });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.data.configured).toBe(true);
      expect(response.body.data.env).toBe('sandbox');
    });

    it('does not return secret in response', async () => {
      vi.mocked(isAdmin).mockReturnValue(true);
      (secretsService.set as any).mockReturnValue({ changes: 1 });
      (plaidService.isConfigured as any).mockReturnValue(true);

      const response = await request(app).post('/save-credentials').send({
        client_id: 'pk_live_12345',
        secret: 'my_secret_key',
        env: 'sandbox',
      });

      expect(response.status).toBe(200);
      const responseBody = JSON.stringify(response.body);
      expect(responseBody).not.toContain('my_secret_key');
      expect(responseBody).not.toContain('plaid_secret');
    });

    it('accepts different environments', async () => {
      vi.mocked(isAdmin).mockReturnValue(true);
      (secretsService.set as any).mockReturnValue({ changes: 1 });
      (plaidService.isConfigured as any).mockReturnValue(true);

      for (const env of ['sandbox', 'development', 'production']) {
        const response = await request(app).post('/save-credentials').send({
          client_id: 'pk_test',
          secret: 'secret',
          env,
        });

        expect(response.status).toBe(200);
        expect(response.body.data.env).toBe(env);
      }
    });
  });

  describe('POST /plaid/clear-credentials', () => {
    beforeEach(() => {
      // Set to OpenID mode to require admin check
      vi.mocked(getActiveLoginMethod).mockReturnValue('openid');
      // Default to non-admin user (unauthorized)
      vi.mocked(isAdmin).mockReturnValue(false);
    });

    it('returns 403 when user is not admin', async () => {
      const response = await request(app).post('/clear-credentials').send({});

      expect(response.status).toBe(403);
      expect(response.body.reason).toBe('not-admin');
    });

    it('successfully clears credentials', async () => {
      vi.mocked(isAdmin).mockReturnValue(true);
      (secretsService.set as any).mockReturnValue({ changes: 1 });

      const response = await request(app).post('/clear-credentials').send({});

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.data.configured).toBe(false);
      expect(secretsService.set).toHaveBeenCalledWith('plaid_clientId', '');
      expect(secretsService.set).toHaveBeenCalledWith('plaid_secret', '');
      expect(secretsService.set).toHaveBeenCalledWith('plaid_env', '');
    });

    it('does not return any secrets', async () => {
      vi.mocked(isAdmin).mockReturnValue(true);
      (secretsService.set as any).mockReturnValue({ changes: 1 });

      const response = await request(app).post('/clear-credentials').send({});

      expect(response.status).toBe(200);
      const responseBody = JSON.stringify(response.body);
      expect(responseBody).not.toContain('secret');
      expect(responseBody).not.toContain('clientId');
    });
  });
});
