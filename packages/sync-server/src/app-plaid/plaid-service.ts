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

type PlaidTransactionResponse = {
  transactions: Array<{
    transaction_id: string;
    account_id: string;
    date: string;
    authorized_date?: string;
    name: string;
    amount: number;
    iso_currency_code?: string;
    unofficial_currency_code?: string;
    transaction_code?: string;
    transaction_type?: string;
    pending: boolean;
    pending_transaction_id?: string;
    categories?: string[];
    category_id?: string;
    counterparties?: Array<{
      name?: string;
    }>;
    merchant_name?: string;
  }>;
  item: {
    item_id: string;
  };
  cursor: string;
  has_more: boolean;
};

type NormalizedPlaidTransaction = {
  transactionId: string;
  amount: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  payeeName: string;
  date: string;
  bookingDate?: string;
  booked: boolean;
  account: string;
  imported_id?: string;
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
   * Fetch and normalize transactions from Plaid
   * Returns transactions in Actual's expected format for import/matching
   */
  async getTransactions(
    itemId: string,
    accountId?: string,
  ): Promise<{
    transactions: NormalizedPlaidTransaction[];
    accountBalance: Array<{
      balanceType: string;
      balanceAmount: {
        amount: string;
        currency: string;
      };
    }>;
    startingBalance: number;
  }> {
    debug(
      `Fetching Plaid transactions for item: ${itemId}, account: ${accountId}`,
    );

    const db = getAccountDb();

    // Verify the item exists and get the access token
    const item = db.first(
      `SELECT item_id, access_token, last_cursor FROM plaid_items WHERE item_id = ?`,
      [itemId],
    ) as {
      item_id: string;
      access_token: string;
      last_cursor?: string;
    } | null;

    if (!item) {
      throw new Error(`Plaid item not found: ${itemId}`);
    }

    try {
      const client = this.initializeClient();
      const allTransactions: NormalizedPlaidTransaction[] = [];
      let cursor = item.last_cursor || undefined;
      let hasMore = true;

      // Fetch all transactions using cursor-based pagination
      while (hasMore) {
        const response = (await client.transactionsSync({
          access_token: item.access_token,
          cursor,
          options: {
            include_personal_finance_category: false,
          },
        })) as any;

        const plaidTransactions = response.data.transactions as any[];

        debug(
          `Fetched ${plaidTransactions.length} transactions from Plaid for item ${itemId}`,
        );

        // Normalize Plaid transactions to Actual format
        for (const transaction of plaidTransactions) {
          // Skip transactions that don't match the requested account (if specified)
          if (accountId && transaction.account_id !== accountId) {
            continue;
          }

          // Handle removed transactions (transaction_id in removed array)
          if (
            transaction.transaction_type === 'TRANSFER' &&
            transaction.removed
          ) {
            continue;
          }

          const normalized = this.normalizePlaidTransaction(transaction);
          allTransactions.push(normalized);
        }

        cursor = response.data.cursor;
        hasMore = response.data.has_more;
      }

      // Update cursor for next sync
      db.mutate(`UPDATE plaid_items SET last_cursor = ? WHERE item_id = ?`, [
        cursor,
        itemId,
      ]);

      debug(`Successfully fetched ${allTransactions.length} transactions`);

      // Return in format expected by loot-core
      return {
        transactions: allTransactions,
        accountBalance: [],
        startingBalance: 0,
      };
    } catch (error) {
      const err = error as any;
      debug(
        `Failed to fetch transactions: ${err?.response?.data?.error_message || err?.message || String(error)}`,
      );
      throw new Error(
        `Failed to fetch transactions: ${err?.response?.data?.error_message || err?.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Normalize a Plaid transaction to Actual's expected format
   * Handles Plaid's sign convention where positive amount = money out
   */
  private normalizePlaidTransaction(
    plaidTrans: any,
  ): NormalizedPlaidTransaction {
    // Plaid convention: positive amount = debit (money out), negative = credit (money in)
    // Actual convention: positive amount = deposit (money in), negative = withdrawal (money out)
    // So we need to negate the amount
    const actualAmount = -plaidTrans.amount;

    return {
      transactionId: plaidTrans.transaction_id,
      amount: String(actualAmount),
      transactionAmount: {
        amount: String(actualAmount),
        currency: plaidTrans.iso_currency_code || 'USD',
      },
      payeeName:
        plaidTrans.merchant_name ||
        plaidTrans.name ||
        plaidTrans.counterparties?.[0]?.name ||
        'Unknown',
      date: plaidTrans.date,
      bookingDate: plaidTrans.date,
      booked: !plaidTrans.pending,
      account: plaidTrans.account_id,
      imported_id: plaidTrans.transaction_id,
    };
  }

  /**
   * Sync transactions from Plaid for an item
   * Fetches transactions and updates sync status
   */
  async syncTransactions(
    itemId: string,
    accountId?: string,
  ): Promise<{ synced: boolean; message: string }> {
    debug(
      `Syncing Plaid transactions for item: ${itemId}, account: ${accountId}`,
    );

    const db = getAccountDb();

    try {
      // Fetch transactions
      await this.getTransactions(itemId, accountId);

      // Update successful sync timestamp
      db.mutate(
        `UPDATE plaid_items SET last_successful_sync = CURRENT_TIMESTAMP, status = 'active' WHERE item_id = ?`,
        [itemId],
      );

      debug(`Transaction sync for item ${itemId} complete`);

      return {
        synced: true,
        message: 'Plaid transactions synced successfully',
      };
    } catch (error) {
      const err = error as any;
      const errorMsg =
        err?.response?.data?.error_message || err?.message || String(error);
      debug(`Failed to sync transactions: ${errorMsg}`);

      // Update error status
      db.mutate(
        `UPDATE plaid_items SET status = 'failed', last_error_code = ? WHERE item_id = ?`,
        [err?.response?.data?.error_code || 'UNKNOWN', itemId],
      );

      throw new Error(`Failed to sync transactions: ${errorMsg}`);
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
