import { getAccountDb } from '../src/account-db';

export const up = async function () {
  await getAccountDb().exec(`
    CREATE TABLE IF NOT EXISTS plaid_items (
      item_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      institution_id TEXT,
      institution_name TEXT,
      status TEXT DEFAULT 'active',
      last_cursor TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_successful_sync DATETIME,
      last_error_code TEXT,
      last_error_type TEXT
    );
  `);

  await getAccountDb().exec(`
    CREATE TABLE IF NOT EXISTS plaid_accounts (
      plaid_account_id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      mask TEXT,
      name TEXT,
      official_name TEXT,
      subtype TEXT,
      type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES plaid_items(item_id) ON DELETE CASCADE
    );
  `);
};

export const down = async function () {
  await getAccountDb().exec(`
    DROP TABLE IF EXISTS plaid_accounts;
  `);

  await getAccountDb().exec(`
    DROP TABLE IF EXISTS plaid_items;
  `);
};
