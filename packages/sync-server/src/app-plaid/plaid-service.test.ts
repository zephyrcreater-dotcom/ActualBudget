import { beforeEach, describe, expect, it, vi } from 'vitest';

import { secretsService } from '#services/secrets-service';

import { plaidService } from './plaid-service';

// Mock the Plaid API
vi.mock('plaid', () => ({
  Configuration: class MockConfiguration {
    constructor(config: any) {
      this.config = config;
    }
    config: any;
  },
  PlaidApi: class MockPlaidApi {
    constructor(config: any) {
      this.config = config;
    }
    config: any;

    async linkTokenCreate() {
      return {
        data: {
          link_token: 'link_token_test_123',
        },
      };
    }

    async itemPublicTokenExchange() {
      return {
        data: {
          item_id: `item_test_${Date.now()}`,
          access_token: `access_token_test_secret_${Date.now()}`,
        },
      };
    }

    async accountsGet() {
      return {
        data: {
          item: {},
          accounts: [
            {
              account_id: 'account_test_123',
              mask: '1234',
              name: 'Checking',
              official_name: 'Chase Checking Account',
              subtype: 'checking',
              type: 'depository',
            },
          ],
        },
      };
    }
  },
  PlaidEnvironments: {
    Sandbox: 'https://sandbox.plaid.com',
    Development: 'https://development.plaid.com',
    Production: 'https://production.plaid.com',
  },
}));

describe('PlaidService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  describe('isConfigured', () => {
    it('returns false when credentials are missing', () => {
      vi.spyOn(secretsService, 'get').mockReturnValue(null);

      const result = plaidService.isConfigured();

      expect(result).toBe(false);
    });

    it('returns true when all credentials are present', () => {
      vi.spyOn(secretsService, 'get').mockImplementation((name: string) => {
        switch (name) {
          case 'plaid_clientId':
            return 'test_client_id';
          case 'plaid_secret':
            return 'test_secret';
          case 'plaid_env':
            return 'sandbox';
          default:
            return null;
        }
      });

      const result = plaidService.isConfigured();

      expect(result).toBe(true);
    });

    it('returns false when only some credentials are present', () => {
      vi.spyOn(secretsService, 'get').mockImplementation((name: string) => {
        switch (name) {
          case 'plaid_clientId':
            return 'test_client_id';
          case 'plaid_secret':
            return 'test_secret';
          default:
            return null;
        }
      });

      const result = plaidService.isConfigured();

      expect(result).toBe(false);
    });
  });

  describe('createLinkToken', () => {
    beforeEach(() => {
      vi.spyOn(secretsService, 'get').mockImplementation((name: string) => {
        switch (name) {
          case 'plaid_clientId':
            return 'test_client_id';
          case 'plaid_secret':
            return 'test_secret';
          case 'plaid_env':
            return 'sandbox';
          default:
            return null;
        }
      });
    });

    it('throws error when Plaid is not configured', async () => {
      vi.spyOn(secretsService, 'get').mockReturnValue(null);

      await expect(
        plaidService.createLinkToken({
          userId: 'user123',
        }),
      ).rejects.toThrow('Plaid is not configured');
    });

    it('successfully creates a link token', async () => {
      const result = await plaidService.createLinkToken({
        userId: 'user123',
      });

      expect(result).toBe('link_token_test_123');
    });

    it('includes redirect URI when provided', async () => {
      const result = await plaidService.createLinkToken({
        userId: 'user123',
        redirectUri: 'https://example.com/callback',
      });

      expect(result).toBe('link_token_test_123');
    });
  });

  describe('exchangePublicToken', () => {
    beforeEach(() => {
      vi.spyOn(secretsService, 'get').mockImplementation((name: string) => {
        switch (name) {
          case 'plaid_clientId':
            return 'test_client_id';
          case 'plaid_secret':
            return 'test_secret';
          case 'plaid_env':
            return 'sandbox';
          default:
            return null;
        }
      });
    });

    it('throws error when Plaid is not configured', async () => {
      vi.spyOn(secretsService, 'get').mockReturnValue(null);

      await expect(
        plaidService.exchangePublicToken({
          publicToken: 'public_token_123',
        }),
      ).rejects.toThrow('Plaid is not configured');
    });

    it('successfully exchanges public token', async () => {
      const result = await plaidService.exchangePublicToken({
        publicToken: 'public_token_123',
        institutionId: 'ins_123',
        institutionName: 'Chase Bank',
      });

      expect(result.itemId).toMatch(/^item_test_\d+$/);
      expect(result.institutionId).toBe('ins_123');
      expect(result.institutionName).toBe('Chase Bank');
      expect(result.status).toBe('active');
      // Ensure access token is NOT returned
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('access_token');
    });
  });

  describe('getPlaidAccounts', () => {
    beforeEach(() => {
      vi.spyOn(secretsService, 'get').mockImplementation((name: string) => {
        switch (name) {
          case 'plaid_clientId':
            return 'test_client_id';
          case 'plaid_secret':
            return 'test_secret';
          case 'plaid_env':
            return 'sandbox';
          default:
            return null;
        }
      });
    });

    it('throws error when item does not exist', async () => {
      await expect(
        plaidService.getPlaidAccounts('nonexistent_item_id'),
      ).rejects.toThrow('Plaid item not found');
    });
  });

  describe('syncTransactions', () => {
    beforeEach(() => {
      vi.spyOn(secretsService, 'get').mockImplementation((name: string) => {
        switch (name) {
          case 'plaid_clientId':
            return 'test_client_id';
          case 'plaid_secret':
            return 'test_secret';
          case 'plaid_env':
            return 'sandbox';
          default:
            return null;
        }
      });
    });

    it('throws error when item does not exist', async () => {
      await expect(
        plaidService.syncTransactions('nonexistent_item_id'),
      ).rejects.toThrow('Plaid item not found');
    });
  });

  describe('getAccessToken', () => {
    it('returns null for non-existent item', () => {
      const token = plaidService.getAccessToken('nonexistent_item_id');

      expect(token).toBeNull();
    });
  });
});
