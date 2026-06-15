import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handlers as app } from './app-plaid';

vi.mock('./plaid-service', () => ({
  plaidService: {
    isConfigured: vi.fn(() => true),
    createLinkToken: vi.fn(),
    exchangePublicToken: vi.fn(),
    getPlaidAccounts: vi.fn(),
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
});
