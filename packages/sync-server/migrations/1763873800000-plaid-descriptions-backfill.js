import { getAccountDb } from '../src/account-db';

export const up = async function () {
  await getAccountDb().exec(`
    ALTER TABLE plaid_items ADD COLUMN descriptions_backfilled INTEGER DEFAULT 0;
  `);
};

export const down = async function () {
  // SQLite does not support DROP COLUMN in older versions; leave as-is.
};
