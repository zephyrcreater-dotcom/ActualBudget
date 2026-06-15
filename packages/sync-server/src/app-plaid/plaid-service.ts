import createDebug from 'debug';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

import { getAccountDb } from '#account-db';
import { secretsService } from '#services/secrets-service';

const debug = createDebug('actual:plaid-service');

type PlaidItem = {
  itemId: string;
  institutionId: string;
  institutionName: string;
  status: string;
};

type PlaidAccount = {
  plaidAccountId: string;
  itemId: string;
  mask: string | null;
  name: string;
  officialName: string;
  subtype: string;
  type: string;
};

type LinkTokenRequest = {
  userId: string;
  redirectUri?: string;
};

type ExchangePublicTokenRequest = {
  publicToken: string;
  institutionId?: string;
  institutionName?: string;
};

class PlaidServiceImpl {
  private client: PlaidApi | null = null;

  /**
   * Initialize Plaid client from stored credentials
   */
  private initializeClient(): PlaidApi {
    if (this.client) {
      return this.client;
    }

    const clientId = secretsService.get('plaid_clientId');
    const secret = secretsService.get('plaid_secret');
    const env = secretsService.get('plaid_env');

    if (!clientId || !secret || !env) {
      throw new Error('Plaid credentials not configured');
    }

    const configuration = new Configuration({
      basePath: this.getPlaidEnv(env),
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    });

    this.client = new PlaidApi(configuration);
    return this.client;
  }

  /**
   * Map environment string to Plaid API endpoint
   */
  private getPlaidEnv(env: string): string {
    switch (env.toLowerCase()) {
      case 'sandbox':
        return PlaidEnvironments.Sandbox;
      case 'development':
        return PlaidEnvironments.Development;
      case 'production':
        return PlaidEnvironments.Production;
      default:
        return PlaidEnvironments.Sandbox;
    }
  }

  /**
   * Check if Plaid is configured with required credentials
   */
  isConfigured(): boolean {
    const clientId = secretsService.get('plaid_clientId');
    const secret = secretsService.get('plaid_secret');
    const env = secretsService.get('plaid_env');

    return Boolean(clientId && secret && env);
  }

  /**
   * Create a Plaid Link token for the frontend
   */
  async createLinkToken(request: LinkTokenRequest): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Plaid is not configured');
    }

    debug(`Creating link token for user ${request.userId}`);

    try {
      const client = this.initializeClient();

      const response = await client.linkTokenCreate({
        user: {
          client_user_id: request.userId,
        },
        client_name: 'Nathaniel Budget',
        language: 'en',
        country_codes: ['US'] as any,
        products: ['auth'] as any,
        redirect_uri: request.redirectUri,
      });

      debug(`Generated link token for user ${request.userId}`);

      return response.data.link_token;
    } catch (error) {
      const err = error as any;
      debug(
        `Failed to create link token: ${err?.response?.data?.error_message || err?.message || String(error)}`,
      );
      throw new Error(
        `Failed to create link token: ${err?.response?.data?.error_message || err?.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Exchange a Plaid public token for an access token
   * Stores the access token securely in the database
   */
  async exchangePublicToken(
    request: ExchangePublicTokenRequest,
  ): Promise<PlaidItem> {
    if (!this.isConfigured()) {
      throw new Error('Plaid is not configured');
    }

    const { publicToken, institutionId, institutionName } = request;

    debug(`Exchanging public token for Plaid access token`);

    try {
      const client = this.initializeClient();

      const response = await client.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const itemId = response.data.item_id;
      const accessToken = response.data.access_token;

      debug(`Received access token for item ${itemId}`);

      // Store the item and access token securely in the database
      const db = getAccountDb();
      db.mutate(
        `INSERT INTO plaid_items (item_id, access_token, institution_id, institution_name, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [itemId, accessToken, institutionId || null, institutionName || null],
      );

      debug(`Stored Plaid item: ${itemId}`);

      return {
        itemId,
        institutionId: institutionId || '',
        institutionName: institutionName || 'Unknown Institution',
        status: 'active',
      };
    } catch (error) {
      const err = error as any;
      debug(
        `Failed to exchange public token: ${err?.response?.data?.error_message || err?.message || String(error)}`,
      );
      throw new Error(
        `Failed to exchange public token: ${err?.response?.data?.error_message || err?.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Fetch accounts for a Plaid item
   */
  async getPlaidAccounts(itemId: string): Promise<PlaidAccount[]> {
    debug(`Fetching Plaid accounts for item: ${itemId}`);

    const db = getAccountDb();

    // Verify the item exists and get the access token
    const item = db.first(
      `SELECT item_id, access_token FROM plaid_items WHERE item_id = ?`,
      [itemId],
    ) as { item_id: string; access_token: string } | null;

    if (!item) {
      throw new Error(`Plaid item not found: ${itemId}`);
    }

    try {
      const client = this.initializeClient();

      // Fetch accounts from Plaid using the stored access token
      const response = await client.accountsGet({
        access_token: item.access_token,
      });

      const accounts = response.data.accounts;
      const accountsData = response.data.item;

      debug(
        `Fetched ${accounts.length} accounts from Plaid for item ${itemId}`,
      );

      // Store or update account metadata in the database
      for (const account of accounts) {
        db.mutate(
          `INSERT OR REPLACE INTO plaid_accounts
           (plaid_account_id, item_id, mask, name, official_name, subtype, type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            account.account_id,
            itemId,
            account.mask,
            account.name,
            account.official_name || null,
            account.subtype || null,
            account.type,
          ],
        );
      }

      debug(`Stored ${accounts.length} account(s) for item ${itemId}`);

      // Return normalized account data (without access token)
      return accounts.map(account => ({
        plaidAccountId: account.account_id,
        itemId,
        mask: account.mask,
        name: account.name,
        officialName: account.official_name || '',
        subtype: account.subtype || '',
        type: account.type,
      }));
    } catch (error) {
      const err = error as any;
      debug(
        `Failed to fetch accounts: ${err?.response?.data?.error_message || err?.message || String(error)}`,
      );
      throw new Error(
        `Failed to fetch accounts: ${err?.response?.data?.error_message || err?.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Sync transactions from Plaid for an item or specific account
   * Placeholder for full transaction sync implementation
   */
  async syncTransactions(
    itemId: string,
    accountId?: string,
  ): Promise<{ synced: boolean; message: string }> {
    debug(
      `Syncing Plaid transactions for item: ${itemId}, account: ${accountId}`,
    );

    const db = getAccountDb();

    // Verify the item exists
    const item = db.first(
      `SELECT item_id, access_token FROM plaid_items WHERE item_id = ?`,
      [itemId],
    ) as { item_id: string; access_token: string } | null;

    if (!item) {
      throw new Error(`Plaid item not found: ${itemId}`);
    }

    try {
      // Placeholder implementation
      // In production, this would:
      // 1. Call Plaid's transactionsSync API (using cursor if available)
      // 2. Parse and normalize transactions to Actual format
      // 3. Return transactions for loot-core to handle import/matching/reconciliation
      // 4. Update last_cursor and last_successful_sync timestamps

      // For now, just mark the sync as successful
      db.mutate(
        `UPDATE plaid_items SET last_successful_sync = CURRENT_TIMESTAMP WHERE item_id = ?`,
        [itemId],
      );

      debug(`Transaction sync for item ${itemId} complete`);

      return {
        synced: true,
        message:
          'Plaid transaction sync placeholder. Ready for loot-core integration.',
      };
    } catch (error) {
      const err = error as any;
      debug(`Failed to sync transactions: ${err?.message || String(error)}`);
      throw new Error(
        `Failed to sync transactions: ${err?.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Get a stored Plaid access token
   * Internal use only - never expose to client
   */
  getAccessToken(itemId: string): string | null {
    const db = getAccountDb();
    const result = db.first(
      `SELECT access_token FROM plaid_items WHERE item_id = ?`,
      [itemId],
    ) as { access_token: string } | null;
    return result?.access_token || null;
  }

  /**
   * Update item sync status and error information
   */
  updateItemSyncStatus(
    itemId: string,
    status: string,
    errorCode?: string,
    errorType?: string,
  ): void {
    debug(`Updating item ${itemId} status: ${status}`);

    const db = getAccountDb();
    db.mutate(
      `UPDATE plaid_items
       SET status = ?, last_error_code = ?, last_error_type = ?, updated_at = CURRENT_TIMESTAMP
       WHERE item_id = ?`,
      [status, errorCode || null, errorType || null, itemId],
    );
  }
}

export const plaidService = new PlaidServiceImpl();
