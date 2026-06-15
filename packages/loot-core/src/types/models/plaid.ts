export type SyncServerPlaidAccount = {
  account_id: string;
  name: string;
  mask?: string | null;
  official_name?: string;
  subtype?: string;
  type: string;
  balance: number;
  itemId?: string;
};
