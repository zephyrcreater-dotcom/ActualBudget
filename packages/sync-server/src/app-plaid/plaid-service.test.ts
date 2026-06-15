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

    async transactionsSync(options: any) {
      return {
        data: {
          transactions: [
            {
              transaction_id: 'txn_test_123',
              account_id: options.access_token ? 'account_test_123' : null,
              date: '2026-06-15',
              name: 'Amazon',
              amount: 50.0,
              iso_currency_code: 'USD',
              merchant_name: 'Amazon',
              pending: false,
            },
            {
              transaction_id: 'txn_test_124',
              account_id: options.access_token ? 'account_test_123' : null,
              date: '2026-06-14',
              name: 'Pending Charge',
              amount: 25.5,
              iso_currency_code: 'USD',
              merchant_name: 'Coffee Shop',
              pending: true,
            },
          ],
          cursor: 'cursor_next_page_123',
          has_more: false,
          item: {
            item_id: 'item_test_123',
          },
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

  describe('getTransactions', () => {
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
        plaidService.getTransactions('nonexistent_item_id'),
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

  describe('normalizePlaidTransaction', () => {
    it('correctly negates amount (Plaid positive = money out)', () => {
      // Plaid: positive amount means money leaving account (debit)
      // Actual: negative amount means money leaving (withdrawal)
      // So Plaid 50.00 should become -50.00 in Actual
      const plaidTrans = {
        transaction_id: 'txn_123',
        account_id: 'acct_123',
        date: '2026-06-15',
        name: 'Gas Station',
        amount: 50.0,
        iso_currency_code: 'USD',
        merchant_name: 'Shell Gas',
        pending: false,
      };

      // Access private method through any cast
      const result = (plaidService as any).normalizePlaidTransaction(
        plaidTrans,
      );

      expect(result.amount).toBe('-50');
      expect(result.transactionAmount.amount).toBe('-50');
      expect(result.booked).toBe(true);
    });

    it('handles pending transactions correctly', () => {
      const plaidTrans = {
        transaction_id: 'txn_pending_123',
        account_id: 'acct_123',
        date: '2026-06-14',
        name: 'Coffee',
        amount: 5.5,
        iso_currency_code: 'USD',
        merchant_name: 'Starbucks',
        pending: true,
      };

      const result = (plaidService as any).normalizePlaidTransaction(
        plaidTrans,
      );

      expect(result.booked).toBe(false);
      expect(result.amount).toBe('-5.5');
    });

    it('uses merchant name as payee when available', () => {
      const plaidTrans = {
        transaction_id: 'txn_123',
        account_id: 'acct_123',
        date: '2026-06-15',
        name: 'Shell Station 12345',
        amount: 50.0,
        iso_currency_code: 'USD',
        merchant_name: 'Shell Oil',
        pending: false,
      };

      const result = (plaidService as any).normalizePlaidTransaction(
        plaidTrans,
      );

      expect(result.payeeName).toBe('Shell Oil');
    });

    it('falls back to transaction name when merchant name not available', () => {
      const plaidTrans = {
        transaction_id: 'txn_123',
        account_id: 'acct_123',
        date: '2026-06-15',
        name: 'Unknown Merchant',
        amount: 50.0,
        iso_currency_code: 'USD',
        pending: false,
      };

      const result = (plaidService as any).normalizePlaidTransaction(
        plaidTrans,
      );

      expect(result.payeeName).toBe('Unknown Merchant');
    });
  });

  describe('getAccessToken', () => {
    it('returns null for non-existent item', () => {
      const token = plaidService.getAccessToken('nonexistent_item_id');

      expect(token).toBeNull();
    });
  });
});
