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
  account_id: string;
  itemId: string;
  mask: string | null;
  name: string;
  official_name?: string;
  subtype?: string;
  type: string;
  balance: number;
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
  /** Raw bank/Plaid transaction name (e.g. "AMAZON MKTPLACE PMTS AMZN.COM/BILL WA"). */
  imported_payee: string;
  /** Raw description stored as transaction notes when a cleaner merchant name is available. */
  notes?: string;
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
        // Prevent axios from hanging indefinitely on slow/unresponsive Plaid API.
        timeout: 30_000,
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
        products: ['transactions'] as any,
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
    console.log('[Plaid] exchangePublicToken: calling itemPublicTokenExchange');

    const client = this.initializeClient();

    let itemId: string;
    let accessToken: string;
    try {
      const response = await client.itemPublicTokenExchange({
        public_token: publicToken,
      });
      itemId = response.data.item_id;
      accessToken = response.data.access_token;
      console.log('[Plaid] exchangePublicToken: OK, item_id=', itemId);
    } catch (error) {
      const err = error as any;
      const msg =
        err?.response?.data?.error_message ||
        err?.response?.data?.error_code ||
        err?.message ||
        String(error);
      console.error(
        '[Plaid] exchangePublicToken: itemPublicTokenExchange FAILED:',
        msg,
      );
      // Re-throw as-is so handleError can inspect err.response.data for Plaid fields.
      throw error;
    }

    const db = getAccountDb();
    // INSERT OR REPLACE so re-linking the same institution (same item_id) doesn't
    // throw a UNIQUE constraint error during repeated testing.
    db.mutate(
      `INSERT OR REPLACE INTO plaid_items
         (item_id, access_token, institution_id, institution_name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [itemId, accessToken, institutionId || null, institutionName || null],
    );
    console.log(
      '[Plaid] exchangePublicToken: item saved to DB, item_id=',
      itemId,
    );

    return {
      itemId,
      institutionId: institutionId || '',
      institutionName: institutionName || 'Unknown Institution',
      status: 'active',
    };
  }

  /**
   * Fetch accounts for a Plaid item
   */
  async getPlaidAccounts(itemId: string): Promise<PlaidAccount[]> {
    console.log('[Plaid] getPlaidAccounts: itemId=', itemId);

    const db = getAccountDb();

    const item = db.first(
      `SELECT item_id, access_token FROM plaid_items WHERE item_id = ?`,
      [itemId],
    ) as { item_id: string; access_token: string } | null;

    if (!item) {
      console.error('[Plaid] getPlaidAccounts: item not found in DB:', itemId);
      throw new Error(`Plaid item not found: ${itemId}`);
    }
    console.log(
      '[Plaid] getPlaidAccounts: item found in DB, calling accountsGet',
    );

    const client = this.initializeClient();

    let accounts: any[];
    try {
      const t0 = Date.now();
      const response = await client.accountsGet({
        access_token: item.access_token,
      });
      accounts = response.data.accounts;
      console.log(
        '[Plaid] getPlaidAccounts: accountsGet OK in',
        Date.now() - t0,
        'ms, accounts=',
        accounts.length,
      );
    } catch (error) {
      const err = error as any;
      const code = err?.response?.data?.error_code;
      const msg =
        err?.response?.data?.error_message ||
        code ||
        err?.message ||
        String(error);
      console.error(
        '[Plaid] getPlaidAccounts: accountsGet FAILED | code:',
        code,
        '| msg:',
        msg,
      );
      // Re-throw original so handleError can extract err.response.data.
      throw error;
    }

    // Store account metadata; separate try so a DB failure is clearly distinct.
    try {
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
      console.log(
        '[Plaid] getPlaidAccounts: stored',
        accounts.length,
        'account(s) in DB',
      );
    } catch (dbErr: any) {
      console.error(
        '[Plaid] getPlaidAccounts: DB write FAILED:',
        dbErr?.message,
      );
      throw dbErr;
    }

    // Field names match SyncServerPlaidAccount; access_token never returned.
    return accounts.map((account: any) => ({
      account_id: account.account_id,
      itemId,
      mask: account.mask,
      name: account.name,
      official_name: account.official_name || undefined,
      subtype: account.subtype || undefined,
      type: account.type,
      balance: account.balances?.current ?? 0,
    }));
  }

  /**
   * Fetch current balances via accountsGet for one or all accounts on an item.
   * Returns full metadata needed for balance repair logging + sign-corrected
   * targetBalance in Actual cents (negative for credit/loan debt).
   */
  async getAccountBalancesForRepair(
    itemId: string,
    plaidAccountId?: string,
  ): Promise<
    Array<{
      plaidAccountId: string;
      name: string;
      type: string;
      subtype: string | null;
      balanceCurrent: number | null;
      balanceAvailable: number | null;
      /** Sign-corrected balance in Actual cents. null when balanceCurrent is null. */
      targetBalance: number | null;
    }>
  > {
    const db = getAccountDb();
    const item = db.first(
      `SELECT item_id, access_token FROM plaid_items WHERE item_id = ?`,
      [itemId],
    ) as { item_id: string; access_token: string } | null;

    if (!item) {
      throw new Error(`Plaid item not found: ${itemId}`);
    }

    const client = this.initializeClient();
    const response = await client.accountsGet({
      access_token: item.access_token,
      options: plaidAccountId ? { account_ids: [plaidAccountId] } : undefined,
    });

    const accounts = (response.data.accounts || []) as any[];

    return accounts.map((a: any) => {
      const rawCurrent: number | null =
        a.balances?.current != null ? Number(a.balances.current) : null;
      const rawAvailable: number | null =
        a.balances?.available != null ? Number(a.balances.available) : null;
      const isDebt = a.type === 'credit' || a.type === 'loan';
      const targetBalance =
        rawCurrent != null
          ? Math.round(rawCurrent * 100) * (isDebt ? -1 : 1)
          : null;

      return {
        plaidAccountId: a.account_id,
        name: a.name,
        type: a.type,
        subtype: a.subtype ?? null,
        balanceCurrent: rawCurrent,
        balanceAvailable: rawAvailable,
        targetBalance,
      };
    });
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
    startingBalance: number | null;
  }> {
    debug(
      `Fetching Plaid transactions for item: ${itemId}, account: ${accountId}`,
    );

    const db = getAccountDb();

    // Verify the item exists and get the access token
    const item = db.first(
      `SELECT item_id, access_token, last_cursor, descriptions_backfilled FROM plaid_items WHERE item_id = ?`,
      [itemId],
    ) as {
      item_id: string;
      access_token: string;
      last_cursor?: string;
      descriptions_backfilled?: number;
    } | null;

    if (!item) {
      throw new Error(`Plaid item not found: ${itemId}`);
    }

    try {
      const client = this.initializeClient();
      const allTransactions: NormalizedPlaidTransaction[] = [];
      // If descriptions have never been backfilled, reset cursor to force a full
      // re-fetch. The reconcile layer deduplicates by imported_id, so no
      // transactions will be duplicated — existing ones get their imported_payee
      // (raw bank description) updated.
      if (!item.descriptions_backfilled) {
        console.log(
          `[Plaid] descriptions_backfilled=0 for item ${itemId} — resetting cursor to backfill raw descriptions`,
        );
        db.mutate(
          `UPDATE plaid_items SET last_cursor = NULL, descriptions_backfilled = 1 WHERE item_id = ?`,
          [itemId],
        );
        item.last_cursor = undefined;
      }

      let cursor = item.last_cursor || undefined;
      let hasMore = true;
      // Capture the most recent accounts array (balances don't change per page)
      let lastAccounts: any[] = [];

      // Fetch all transactions using cursor-based pagination
      while (hasMore) {
        const response = (await client.transactionsSync({
          access_token: item.access_token,
          cursor,
          options: {
            include_personal_finance_category: false,
          },
        })) as any;

        // transactionsSync returns `added` + `modified` arrays (not `transactions`)
        // and `next_cursor` (not `cursor`).
        const added = (response.data.added || []) as any[];
        const modified = (response.data.modified || []) as any[];
        const plaidTransactions = [...added, ...modified];
        lastAccounts = (response.data.accounts || []) as any[];

        debug(
          `Fetched ${plaidTransactions.length} transactions from Plaid for item ${itemId}`,
        );

        // Normalize Plaid transactions to Actual format
        for (const transaction of plaidTransactions) {
          // Skip transactions that don't match the requested account (if specified)
          if (accountId && transaction.account_id !== accountId) {
            continue;
          }

          const normalized = this.normalizePlaidTransaction(transaction);
          allTransactions.push(normalized);
        }

        cursor = response.data.next_cursor;
        hasMore = response.data.has_more;
      }

      // Update cursor for next sync
      db.mutate(`UPDATE plaid_items SET last_cursor = ? WHERE item_id = ?`, [
        cursor,
        itemId,
      ]);

      debug(`Successfully fetched ${allTransactions.length} transactions`);

      // Extract current balance for the requested account.
      // transactionsSync includes an `accounts` array with up-to-date balances.
      // Plaid convention: credit card `current` is positive = amount owed (debt).
      // Actual convention: debt is negative, so we negate credit/loan balances.
      // null means "Plaid returned no balance data" — distinct from a genuine $0
      // balance. Callers must check for null before adjusting starting balances.
      let startingBalance: number | null = null;
      const acctData = accountId
        ? lastAccounts.find((a: any) => a.account_id === accountId)
        : lastAccounts[0];
      if (acctData) {
        const rawCurrent: number | null | undefined =
          acctData.balances?.current;
        if (rawCurrent != null) {
          const isDebt = acctData.type === 'credit' || acctData.type === 'loan';
          startingBalance = Math.round(rawCurrent * 100) * (isDebt ? -1 : 1);
          console.log(
            `[Plaid] getTransactions balance — account: ${accountId}, type: ${acctData.type}, current: ${rawCurrent}, startingBalance (cents): ${startingBalance}`,
          );
        } else {
          console.log(
            `[Plaid] getTransactions balance — account: ${accountId}, type: ${acctData.type}, balances.current is null/undefined — returning null to skip balance adjustment`,
          );
        }
      } else {
        console.log(
          `[Plaid] getTransactions balance — account: ${accountId} not found in transactionsSync accounts array — returning null`,
        );
      }

      return {
        transactions: allTransactions,
        accountBalance: [],
        startingBalance,
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

    // Use the clean merchant name as the primary payee when Plaid provides one,
    // otherwise fall back to the raw transaction name.
    const rawName: string = plaidTrans.name || 'Unknown';
    const merchantName: string | undefined =
      plaidTrans.merchant_name || plaidTrans.counterparties?.[0]?.name;
    const payeeName = merchantName || rawName;

    // Store the raw bank description as imported_payee so it's always preserved.
    // When a cleaner merchant name is used as the payee, also copy it into notes
    // so users can see the original description without opening the import tooltip.
    // TODO: add a per-account toggle "Show original bank descriptions" that controls
    //       whether notes are auto-populated from Plaid's raw transaction name.
    const notes =
      merchantName && merchantName !== rawName ? rawName : undefined;

    console.log(
      `[Plaid] normalizePlaidTransaction — id: ${plaidTrans.transaction_id}, merchant_name: ${plaidTrans.merchant_name ?? '(none)'}, name: ${rawName}, payeeName: ${payeeName}, imported_payee: ${rawName}, notes: ${notes ?? '(none)'}`,
    );

    return {
      transactionId: plaidTrans.transaction_id,
      amount: String(actualAmount),
      transactionAmount: {
        amount: String(actualAmount),
        currency: plaidTrans.iso_currency_code || 'USD',
      },
      payeeName,
      imported_payee: rawName,
      notes,
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

  listItems(): Array<{
    itemId: string;
    institutionId: string | null;
    institutionName: string | null;
    status: string;
    createdAt: string;
    accountCount: number;
  }> {
    const db = getAccountDb();
    return (
      db.all(
        `SELECT i.item_id, i.institution_id, i.institution_name, i.status, i.created_at,
                COUNT(a.plaid_account_id) AS account_count
         FROM plaid_items i
         LEFT JOIN plaid_accounts a ON a.item_id = i.item_id
         GROUP BY i.item_id
         ORDER BY i.created_at DESC`,
        [],
      ) as Array<{
        item_id: string;
        institution_id: string | null;
        institution_name: string | null;
        status: string;
        created_at: string;
        account_count: number;
      }>
    ).map(row => ({
      itemId: row.item_id,
      institutionId: row.institution_id,
      institutionName: row.institution_name,
      status: row.status,
      createdAt: row.created_at,
      accountCount: row.account_count,
    }));
  }

  async removeItem(itemId: string): Promise<void> {
    const db = getAccountDb();

    const item = db.first(
      `SELECT access_token FROM plaid_items WHERE item_id = ?`,
      [itemId],
    ) as { access_token: string } | null;

    if (!item) {
      throw new Error(`Plaid item not found: ${itemId}`);
    }

    const client = this.initializeClient();

    try {
      await client.itemRemove({ access_token: item.access_token });
      console.log('[Plaid] itemRemove: Plaid confirmed removal of', itemId);
    } catch (err: any) {
      // ITEM_NOT_FOUND means Plaid already deleted it — treat as success.
      const code = err?.response?.data?.error_code;
      if (code !== 'ITEM_NOT_FOUND') {
        throw new Error(
          `Plaid itemRemove failed: ${err?.response?.data?.error_message || err?.message || String(err)}`,
        );
      }
      console.warn(
        '[Plaid] itemRemove: item not found on Plaid side, removing locally anyway',
      );
    }

    // Cascade delete: plaid_accounts FK references plaid_items with ON DELETE CASCADE.
    db.mutate(`DELETE FROM plaid_items WHERE item_id = ?`, [itemId]);
    console.log('[Plaid] removeItem: deleted local records for', itemId);
  }
}

export const plaidService = new PlaidServiceImpl();
