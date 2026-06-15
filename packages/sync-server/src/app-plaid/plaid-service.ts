import createDebug from 'debug';
import { v4 as uuidv4 } from 'uuid';

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
  mask: string;
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

export const plaidService = {
  /**
   * Check if Plaid is configured with required credentials
   */
  isConfigured: () => {
    const clientId = secretsService.get('plaid_clientId');
    const secret = secretsService.get('plaid_secret');
    const env = secretsService.get('plaid_env');

    return Boolean(clientId && secret && env);
  },

  /**
   * Create a Plaid Link token for the frontend
   * In a real implementation, this would call the Plaid API
   * For now, return a placeholder that the client can use
   */
  createLinkToken: async (request: LinkTokenRequest): Promise<string> => {
    if (!plaidService.isConfigured()) {
      throw new Error('Plaid is not configured');
    }

    debug(`Creating link token for user ${request.userId}`);

    // Placeholder implementation
    // In production, this would:
    // 1. Call Plaid's createLinkToken API
    // 2. Return a real link token
    const linkToken = `link_token_${uuidv4()}`;

    debug(`Generated placeholder link token: ${linkToken}`);

    return linkToken;
  },

  /**
   * Exchange a Plaid public token for an access token
   * Stores the access token securely in the database
   */
  exchangePublicToken: async (
    request: ExchangePublicTokenRequest,
  ): Promise<PlaidItem> => {
    if (!plaidService.isConfigured()) {
      throw new Error('Plaid is not configured');
    }

    const { publicToken, institutionId, institutionName } = request;

    debug(`Exchanging public token for Plaid access token`);

    // Placeholder implementation
    // In production, this would:
    // 1. Call Plaid's itemPublicTokenExchange API with publicToken
    // 2. Receive an access_token and item_id
    const itemId = `item_${uuidv4()}`;
    const accessToken = `access_token_${uuidv4()}`;

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
  },

  /**
   * Fetch accounts for a Plaid item
   */
  getPlaidAccounts: async (itemId: string): Promise<PlaidAccount[]> => {
    debug(`Fetching Plaid accounts for item: ${itemId}`);

    const db = getAccountDb();

    // Verify the item exists
    const item = db.first(`SELECT * FROM plaid_items WHERE item_id = ?`, [
      itemId,
    ]);

    if (!item) {
      throw new Error(`Plaid item not found: ${itemId}`);
    }

    // Placeholder implementation
    // In production, this would:
    // 1. Retrieve the access_token from plaid_items table
    // 2. Call Plaid's accountsGet API
    // 3. Parse and normalize the response
    // 4. Store account metadata in plaid_accounts table

    // For now, return any stored accounts from the database
    const accounts = db.all(`SELECT * FROM plaid_accounts WHERE item_id = ?`, [
      itemId,
    ]) as Array<{
      plaid_account_id: string;
      item_id: string;
      mask: string;
      name: string;
      official_name: string;
      subtype: string;
      type: string;
    }>;

    debug(`Found ${accounts.length} Plaid accounts for item ${itemId}`);

    return accounts.map(acc => ({
      plaidAccountId: acc.plaid_account_id,
      itemId: acc.item_id,
      mask: acc.mask,
      name: acc.name,
      officialName: acc.official_name,
      subtype: acc.subtype,
      type: acc.type,
    }));
  },

  /**
   * Sync transactions from Plaid for an item or specific account
   * Placeholder for full transaction sync implementation
   */
  syncTransactions: async (
    itemId: string,
    accountId?: string,
  ): Promise<{ synced: boolean; message: string }> => {
    debug(
      `Syncing Plaid transactions for item: ${itemId}, account: ${accountId}`,
    );

    const db = getAccountDb();

    // Verify the item exists
    const item = db.first(`SELECT * FROM plaid_items WHERE item_id = ?`, [
      itemId,
    ]);

    if (!item) {
      throw new Error(`Plaid item not found: ${itemId}`);
    }

    // Placeholder implementation
    // In production, this would:
    // 1. Retrieve the access_token from plaid_items table
    // 2. Call Plaid's transactionsSync API (using cursor if available)
    // 3. Parse and normalize transactions to Actual format
    // 4. Return transactions for loot-core to handle import/matching/reconciliation
    // 5. Update last_cursor and last_successful_sync timestamps

    // Update the last_successful_sync timestamp
    db.mutate(
      `UPDATE plaid_items SET last_successful_sync = CURRENT_TIMESTAMP WHERE item_id = ?`,
      [itemId],
    );

    debug(`Transaction sync placeholder for item ${itemId} complete`);

    return {
      synced: true,
      message:
        'Plaid transaction sync scaffold complete. Full sync implementation coming next.',
    };
  },

  /**
   * Get a stored Plaid access token
   * Internal use only - never expose to client
   */
  getAccessToken: (itemId: string): string | null => {
    const db = getAccountDb();
    const result = db.first(
      `SELECT access_token FROM plaid_items WHERE item_id = ?`,
      [itemId],
    );
    return result?.access_token || null;
  },

  /**
   * Update item sync status and error information
   */
  updateItemSyncStatus: (
    itemId: string,
    status: string,
    errorCode?: string,
    errorType?: string,
  ): void => {
    debug(`Updating item ${itemId} status: ${status}`);

    const db = getAccountDb();
    db.mutate(
      `UPDATE plaid_items
       SET status = ?, last_error_code = ?, last_error_type = ?, updated_at = CURRENT_TIMESTAMP
       WHERE item_id = ?`,
      [status, errorCode || null, errorType || null, itemId],
    );
  },
};
