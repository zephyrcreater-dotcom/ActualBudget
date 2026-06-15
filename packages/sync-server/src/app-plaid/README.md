# Plaid Integration

This directory contains the Plaid provider implementation for Actual Budget's sync server.

## Overview

Plaid is integrated as a bank sync provider alongside other providers like GoCardless, SimpleFIN, and Enable Banking. This implementation follows the existing provider architecture to minimize changes to loot-core's reconciliation and accounting logic.

## Architecture

### Token Storage

- **Global app credentials**: Stored in the `secrets` table:
  - `plaid_clientId`
  - `plaid_secret`
  - `plaid_env` (sandbox, development, or production)

- **Per-item tokens**: Stored in dedicated tables:
  - `plaid_items`: Item metadata and access tokens
  - `plaid_accounts`: Account information for each item

### Key Design Principles

1. **No tokens in budget database**: Plaid access tokens are stored only in the sync server database, never in the user's budget file
2. **Reuse existing sync pipeline**: Transactions are normalized and passed through loot-core's existing matching and reconciliation logic
3. **Map to existing sync states**: Plaid errors are mapped to existing states (`ok`, `reauth-required`, `attention-required`, `failed`)

## Endpoints

### `/status`

**Method**: POST

Check if Plaid is configured.

**Response**:

```json
{
  "status": "ok",
  "data": {
    "configured": true
  }
}
```

### `/create-link-token`

**Method**: POST

Create a Plaid Link token for the frontend to initiate the linking flow.

**Request**:

```json
{
  "userId": "user-id",
  "redirectUri": "https://example.com/callback"
}
```

**Response**:

```json
{
  "status": "ok",
  "data": {
    "linkToken": "link_token_..."
  }
}
```

### `/exchange-public-token`

**Method**: POST

Exchange a public token (from Plaid Link) for an access token. Stores the item securely.

**Request**:

```json
{
  "publicToken": "public_token_...",
  "institutionId": "ins_123",
  "institutionName": "Chase Bank"
}
```

**Response**:

```json
{
  "status": "ok",
  "data": {
    "itemId": "item_...",
    "institutionId": "ins_123",
    "institutionName": "Chase Bank",
    "status": "active"
  }
}
```

### `/get-plaid-accounts`

**Method**: POST

Fetch accounts for a linked Plaid item.

**Request**:

```json
{
  "itemId": "item_..."
}
```

**Response**:

```json
{
  "status": "ok",
  "data": {
    "accounts": [
      {
        "plaidAccountId": "account_...",
        "itemId": "item_...",
        "mask": "1234",
        "name": "Checking",
        "officialName": "Chase Checking",
        "subtype": "checking",
        "type": "depository"
      }
    ]
  }
}
```

### `/sync-plaid-transactions`

**Method**: POST

Trigger a transaction sync for a Plaid item (placeholder for full implementation).

**Request**:

```json
{
  "itemId": "item_...",
  "accountId": "account_..." (optional)
}
```

**Response**:

```json
{
  "status": "ok",
  "data": {
    "synced": true,
    "message": "..."
  }
}
```

## Implementation Status

### ✓ Completed

- [x] Environment configuration for app-level secrets
- [x] Database tables for storing items and accounts
- [x] Endpoint stubs for all major flows
- [x] Error mapping to sync states
- [x] Security: tokens stored server-side only

### 🚧 Scaffolded (Placeholder Implementation)

- [ ] Actual Plaid SDK integration (plaid-node)
- [ ] Real link token creation
- [ ] Public token exchange with Plaid API
- [ ] Account fetching from Plaid
- [ ] Transaction syncing with cursor-based pagination
- [ ] Webhook handling (optional phase two)

### → Next Steps (Not Yet Implemented)

- Desktop-client UI for Plaid setup
- loot-core Plaid provider dispatch
- Transaction normalization and import
- Account linking and reconciliation
- Multi-user/server-hosted account scoping

## Database Schema

### plaid_items

```sql
CREATE TABLE plaid_items (
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
```

### plaid_accounts

```sql
CREATE TABLE plaid_accounts (
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
```

## Security Notes

1. **Never expose access tokens**: The `getAccessToken()` method is internal only
2. **Redact sensitive errors**: Error responses never include token values
3. **Validate session**: All endpoints require `validateSessionMiddleware`
4. **Admin-only in OpenID mode**: Secret management is admin-only when OpenID is active
5. **Future: Encryption**: Consider adding at-rest encryption for stored tokens in production deployments

## Testing

Tests should verify:

- [ ] Status endpoint returns correct configuration state
- [ ] Link token creation without real API calls
- [ ] Item storage and retrieval
- [ ] Error handling and mapping
- [ ] Account listing from stored metadata
- [ ] Transaction sync placeholder behavior

## References

- [PLAID_INTEGRATION_PLAN.md](../../PLAID_INTEGRATION_PLAN.md)
- [PROJECT_HANDOFF.md](../../PROJECT_HANDOFF.md)
- [Plaid API Documentation](https://plaid.com/docs/)
