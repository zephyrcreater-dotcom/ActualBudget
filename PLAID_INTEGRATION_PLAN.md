# Plaid Integration Plan

## Goal

Add Plaid to Actual Budget without disturbing the local-first budgeting engine, reconciliation behavior, or existing sync providers.

The safest approach is to treat Plaid as **another bank sync provider** that plugs into the existing provider architecture:

- `packages/desktop-client` handles provider setup UX and account linking
- `packages/loot-core` handles account link metadata, transaction normalization, matching, reconciliation, and balance updates
- `packages/sync-server` owns Plaid credentials, access tokens, account fetches, and transaction fetches

This keeps Actual's accounting core intact and limits Plaid-specific behavior to the same seams already used by GoCardless, SimpleFIN, Pluggy, Akahu, and Enable Banking.

---

## Current Architecture

### 1. Web app / desktop-client provider UX

Relevant files:

- `packages/desktop-client/src/components/banksync/index.tsx`
- `packages/desktop-client/src/components/banksync/BuiltInProviders.tsx`
- `packages/desktop-client/src/components/banksync/useBuiltInBankSyncProviders.ts`
- `packages/desktop-client/src/components/banksync/bankSyncUtils.ts`
- `packages/desktop-client/src/components/modals/SelectLinkedAccountsModal.tsx`
- `packages/desktop-client/src/accounts/mutations.ts`
- `packages/desktop-client/src/gocardless.ts`
- `packages/desktop-client/src/enablebanking.ts`

What this layer does today:

- Shows available built-in providers
- Checks provider configuration status
- Opens provider-specific setup/auth flows
- Fetches external accounts from the provider
- Lets the user map external accounts to Actual accounts
- Calls provider-specific link mutations

Important design detail:

The UI is already structured around a provider list with provider-specific actions. Plaid can be added here without changing the rest of the banking UI model.

### 2. Core sync and reconciliation in loot-core

Relevant files:

- `packages/loot-core/src/server/accounts/app.ts`
- `packages/loot-core/src/server/accounts/sync.ts`
- `packages/loot-core/src/server/accounts/link.ts`
- `packages/loot-core/src/types/models/bank-sync.ts`
- `packages/loot-core/src/types/models/bank.ts`
- `packages/loot-core/src/server/accounts/app-bank-sync.test.ts`

What this layer does today:

- Stores linked-account metadata on Actual accounts
- Tracks provider identity via `account_sync_source`
- Creates or upgrades linked accounts
- Downloads bank data through provider-specific adapters
- Normalizes provider transactions into Actual transaction format
- Matches imported transactions to existing ones
- Reconciles inserts/updates
- Writes `raw_synced_data`
- Updates account balances
- Persists sync status and sync errors

Important design detail:

`packages/loot-core/src/server/accounts/sync.ts` is the critical abstraction seam. Each provider has a download function, but the normalization, matching, reconciliation, and balance update logic is shared. That is exactly what Plaid should reuse.

### 3. Sync server provider backends

Relevant files:

- `packages/sync-server/src/app.ts`
- `packages/sync-server/src/account-db.js`
- `packages/sync-server/src/app-secrets.js`
- `packages/sync-server/src/services/secrets-service.js`
- `packages/sync-server/src/app-gocardless/app-gocardless.ts`
- `packages/sync-server/src/app-simplefin/app-simplefin.js`
- `packages/sync-server/src/app-pluggyai/app-pluggyai.js`
- `packages/sync-server/src/app-akahu/app-akahu.ts`
- `packages/sync-server/src/app-enablebanking/app-enablebanking.ts`
- `packages/sync-server/migrations/1694362247011-create-secret-table.js`

What this layer does today:

- Exposes provider-specific HTTP endpoints like `/gocardless`, `/simplefin`, `/pluggyai`, `/akahu`, `/enablebanking`
- Stores provider secrets in `server-files/account.sqlite`
- Validates sessions before allowing provider access
- Talks to third-party banking APIs
- Returns normalized account and transaction payloads back to the client/core

Important design detail:

The sync server already has a clear pattern for adding another provider app. Plaid fits naturally as a new sibling route, for example `/plaid`.

---

## How Actual Currently Handles Bank Sync

### Bank-linked accounts

Current behavior lives mainly in:

- `packages/loot-core/src/server/accounts/app.ts`
- `packages/loot-core/src/server/accounts/link.ts`

Linked accounts are still normal Actual accounts. Bank sync adds metadata such as:

- `account_id` for the provider-side account id
- `bank` for the linked institution/bank record
- `account_sync_source` for provider identity
- `balance_current`
- `balance_available`
- `balance_limit`
- `last_sync`
- `bank_sync_status`

This is good for Plaid because it means:

- no new accounting model is required
- no special ledger/account type is required
- Plaid-linked accounts can behave like any other linked account

### Imported transactions

Current behavior lives mainly in:

- `packages/loot-core/src/server/accounts/sync.ts`
- `packages/loot-core/src/server/accounts/app.ts`

Provider payloads are normalized into Actual transactions with:

- `amount`
- `date`
- `payee`
- `notes`
- `account`
- `imported_id`
- `imported_payee`
- `cleared`
- `raw_synced_data`

This is the most important part to preserve. Plaid should feed this existing import pipeline instead of introducing new transaction logic.

### Transaction matching

Current behavior lives mainly in:

- `packages/loot-core/src/server/accounts/sync.ts`

Matching strategy today:

- first match by `imported_id`
- then fuzzy match by account + amount + nearby date
- prefer payee matches when available
- then fall back to first remaining likely candidate

This means Plaid integration quality depends heavily on picking a stable `imported_id` strategy. That should be designed very carefully.

### Account balances

Current behavior lives mainly in:

- `packages/loot-core/src/server/accounts/sync.ts`
- `packages/loot-core/src/server/accounts/app.ts`

Provider balance payloads are normalized, then account balances are updated through the existing bank sync pipeline. Plaid should supply balance data in the same normalized shape already expected by `processBankSyncDownload`.

### Connection credentials and tokens

Current behavior lives mainly in:

- `packages/sync-server/src/services/secrets-service.js`
- `packages/sync-server/src/app-secrets.js`
- `packages/sync-server/src/account-db.js`

Today, provider configuration secrets are stored in the sync server's `account.sqlite` database, usually in the `secrets` table.

Examples:

- GoCardless client credentials
- SimpleFIN token and derived access key
- Enable Banking app id and secret key

Important limitation:

This works well for global provider credentials, but Plaid also introduces **per-item access tokens**. Those should not be treated as global singleton secrets.

### Sync errors

Current behavior lives mainly in:

- `packages/loot-core/src/server/accounts/app.ts`
- provider apps under `packages/sync-server/src/app-*`

Sync errors are converted into user-facing account states such as:

- `ok`
- `reauth-required`
- `attention-required`
- `failed`

Plaid integration should map Plaid errors into these existing states rather than inventing a new sync-status model.

---

## Best Place To Add Plaid

## Recommendation

Add Plaid as a **new provider alongside the existing providers**.

That means:

### In `packages/sync-server`

Add a new provider app, likely:

- `packages/sync-server/src/app-plaid/`

Expected responsibilities:

- Link token creation
- Public token exchange
- Item access token storage
- Account list fetch
- Balance fetch
- Transaction fetch
- Webhook handling if enabled
- Error translation from Plaid into Actual's provider response shape

### In `packages/loot-core`

Extend the existing bank sync provider plumbing:

- add `plaid` to `SYNC_PROVIDERS`
- add a Plaid download adapter in `packages/loot-core/src/server/accounts/sync.ts`
- add `plaid-status`, `plaid-accounts`, and `plaid-accounts-link` handlers in `packages/loot-core/src/server/accounts/app.ts`
- extend the normalized external account types

### In `packages/desktop-client`

Add Plaid to the built-in provider list and linking flow:

- provider card in `useBuiltInBankSyncProviders.ts`
- provider id in `bankSyncUtils.ts`
- Plaid account-link mutation in `accounts/mutations.ts`
- support for `syncSource: 'plaid'` in `SelectLinkedAccountsModal.tsx`
- Plaid auth helper similar to `gocardless.ts` or `enablebanking.ts`

---

## Approach Comparison

### Option A: Add Plaid alongside existing providers

Summary:

Use the current provider architecture and make Plaid another provider.

Pros:

- Lowest risk to accounting logic
- Reuses existing reconciliation and matching pipeline
- Preserves current linked-account model
- Preserves existing bank sync UI model
- Easy to ship incrementally
- Easier rollback if Plaid work goes sideways

Cons:

- Some provider-specific boilerplate must be added in several packages
- `SYNC_PROVIDERS` unions and provider-switch logic must grow
- Plaid-specific token storage needs a new server-side model

Verdict:

**Best option**

### Option B: Replace the existing bank sync provider layer

Summary:

Refactor the whole provider stack into a new generic provider framework and fold Plaid into that rewrite.

Pros:

- Cleaner architecture in theory
- Could reduce duplicated provider-specific code over time

Cons:

- High blast radius
- Easy to break working providers
- Delays Plaid because architecture work comes first
- Touches stable bank sync and reconciliation wiring for little near-term gain

Verdict:

**Too risky for a first Plaid implementation**

### Option C: Build Plaid only in sync-server

Summary:

Hide Plaid inside the sync server and avoid updating the web app/core provider model much.

Pros:

- Smaller surface area in the short term

Cons:

- Doesn't fit the current client/core design
- The web app still needs provider status, setup flow, account discovery, and link actions
- `loot-core` still needs an explicit provider identity for linked accounts
- Makes the system harder to reason about because Plaid becomes a hidden special case

Verdict:

**Not recommended**

---

## Safest Implementation Path

Use **Option A** and keep Plaid-specific logic isolated to the same boundaries already used by existing providers.

### Principle

Plaid should only answer these questions:

- Which institutions/accounts are available?
- What are the latest balances?
- What are the imported transactions?
- Does the connection need reauthentication?

Everything else should continue to be Actual's existing logic:

- linked account metadata
- reconciliation
- transaction matching
- transaction insertion/update
- balance persistence
- budget math
- reports

---

## Proposed Data Flow

### 1. Provider setup

1. User opens Bank Sync in the web app
2. `desktop-client` shows Plaid as a built-in provider
3. User starts Plaid linking flow
4. `desktop-client` requests a link token from `sync-server`
5. Plaid Link runs in the browser
6. Browser receives a `public_token`
7. `desktop-client` sends the `public_token` to `loot-core`
8. `loot-core` forwards the request to `sync-server`
9. `sync-server` exchanges `public_token` for an `access_token`
10. `sync-server` stores the item token and metadata

### 2. Account linking

1. `sync-server` fetches Plaid accounts for the item
2. `desktop-client` opens `SelectLinkedAccountsModal`
3. User maps a Plaid account to an Actual account or creates a new account
4. `loot-core` link handler writes:
   - provider account id
   - institution/bank metadata
   - `account_sync_source = 'plaid'`
5. `loot-core` immediately runs the existing sync pipeline for first import

### 3. Ongoing sync

1. User or scheduled sync triggers `accounts-bank-sync`
2. `loot-core` sees `account_sync_source = 'plaid'`
3. `loot-core` calls Plaid download adapter in `accounts/sync.ts`
4. Adapter requests transactions and balances from `sync-server`
5. `sync-server` uses stored item/account tokens to call Plaid
6. Adapter converts Plaid response into Actual's normalized bank sync response
7. Existing reconciliation pipeline processes:
   - initial sync handling
   - pending/booked rules
   - transaction matching
   - transaction insertion/update
   - balance update
   - sync status update

### 4. Reauth / broken connection

1. Plaid returns an auth or item error
2. `sync-server` maps it into a normalized provider error
3. `loot-core` maps it into:
   - `reauth-required`
   - `attention-required`
   - `failed`
4. UI surfaces the existing account sync warning state

---

## Token Storage Strategy

## Recommendation

Split Plaid storage into **two layers**:

### Layer 1: global app credentials

Store in existing secrets infrastructure:

- `plaid_clientId`
- `plaid_secret`
- `plaid_env`
- optionally `plaid_webhookSecret`

Best location:

- `packages/sync-server/src/services/secrets-service.js`
- persisted in `server-files/account.sqlite` `secrets` table

This matches how other providers store app-level secrets today.

### Layer 2: per-item access tokens and metadata

Store in a **new sync-server table**, not the global secrets table.

Suggested new table:

- `plaid_items`

Suggested columns:

- `item_id` primary key
- `access_token`
- `institution_id`
- `institution_name`
- `user_id` if multi-user separation is required
- `status`
- `last_cursor` if transaction sync cursors are used
- `created_at`
- `updated_at`
- `last_successful_sync`
- `last_error_code`
- `last_error_type`

Possible second table:

- `plaid_accounts`

Suggested columns:

- `plaid_account_id`
- `item_id`
- `mask`
- `name`
- `official_name`
- `subtype`
- `type`

Why not use only `secrets`?

- Plaid access tokens are not singleton app configuration
- one server may hold many linked items
- multi-user/server-hosted deployments need better separation
- cursor-based transaction sync needs per-item state
- webhook-driven updates need per-item lookup

### Encryption note

The current server stores secrets in SQLite. If Plaid is added, item access tokens become more sensitive operationally because they fan out per linked institution.

Minimum recommendation:

- keep all Plaid tokens server-side only
- never write Plaid access tokens into the budget database
- never expose them through desktop-client or loot-core logs
- redact token-bearing errors

Longer-term recommendation:

- add optional at-rest encryption for provider item tokens, or use an encrypted secrets backend when hosted

---

## Security Concerns

### 1. Keep Plaid secrets out of the budget file

The budget file must remain portable and local-first. Plaid credentials belong only in the sync-server account database or a dedicated external secret store.

### 2. Support hosted multi-user correctly

Actual's sync server already supports multi-user concepts. Plaid tokens should be tied to the authenticated server user or ownership scope, not treated as global shared state unless that is an explicit product decision.

### 3. Avoid logging sensitive tokens

Plaid integration code should never log:

- `access_token`
- `public_token`
- link token secrets
- webhook verification secrets

### 4. Treat webhooks as optional phase two

Webhook endpoints add operational complexity:

- signature verification
- public HTTPS exposure
- retry handling
- idempotency

For the first implementation, polling/manual sync is safer. Webhooks can be a later optimization.

### 5. Handle SSRF and outbound URL risk carefully

Existing sync-server code already has SSRF concerns in some providers. Plaid should use fixed Plaid API endpoints and avoid dynamic user-supplied URLs.

### 6. Reauth flows should reuse existing sync status model

Do not create a new Plaid-only broken-state UX. Reuse:

- `reauth-required`
- `attention-required`
- `failed`

---

## Required Environment Variables

Actual's current provider pattern stores most configuration in the sync server database, but Plaid will likely need both environment configuration and persisted secrets.

Recommended environment variables:

- `ACTUAL_PLAID_ENABLED=true`
- `ACTUAL_PLAID_ENV=sandbox|development|production`
- `ACTUAL_PLAID_REDIRECT_URI=https://...` if a hosted OAuth-style redirect is needed
- `ACTUAL_PLAID_WEBHOOK_URL=https://...` only if webhooks are enabled later

Recommended persisted sync-server secrets:

- `plaid_clientId`
- `plaid_secret`
- `plaid_env`
- `plaid_webhookSecret` if webhook verification is enabled

Why both env vars and persisted secrets?

- env vars are good for deployment-wide toggles and defaults
- sync-server secrets are good for runtime configuration through Actual's existing admin/provider setup flows

For a first pass, the cleanest model is:

- enable/feature flag via env var
- app credentials persisted through existing provider setup UI into sync-server secrets

---

## Package and File Locations To Add

### Desktop client

Likely changes:

- `packages/desktop-client/src/components/banksync/useBuiltInBankSyncProviders.ts`
- `packages/desktop-client/src/components/banksync/bankSyncUtils.ts`
- `packages/desktop-client/src/components/modals/SelectLinkedAccountsModal.tsx`
- `packages/desktop-client/src/accounts/mutations.ts`
- new Plaid auth helper, for example:
  - `packages/desktop-client/src/plaid.ts`
- new setup modal if needed, for example:
  - `packages/desktop-client/src/components/modals/PlaidInitModal.tsx`

### Loot core

Likely changes:

- `packages/loot-core/src/types/models/bank-sync.ts`
- new Plaid account/transaction types under `packages/loot-core/src/types/models/`
- `packages/loot-core/src/server/server-config.ts`
- `packages/loot-core/src/server/accounts/app.ts`
- `packages/loot-core/src/server/accounts/sync.ts`
- possibly `packages/loot-core/src/server/accounts/link.ts`

### Sync server

Likely changes:

- `packages/sync-server/src/app.ts`
- `packages/sync-server/src/services/secrets-service.js`
- new provider app:
  - `packages/sync-server/src/app-plaid/app-plaid.ts`
- new Plaid service helpers:
  - `packages/sync-server/src/app-plaid/plaid-service.ts`
  - `packages/sync-server/src/app-plaid/normalize.ts`
  - `packages/sync-server/src/app-plaid/errors.ts`
- new migrations for item/token storage:
  - `packages/sync-server/migrations/<timestamp>-create-plaid-items-table.js`
  - optionally `packages/sync-server/migrations/<timestamp>-create-plaid-accounts-table.js`

---

## Incremental PR Plan

### PR 1: Add Plaid provider types and feature flag

Goal:

- Add `plaid` to provider enums and feature-flag plumbing without enabling anything yet

Likely files:

- `packages/loot-core/src/types/models/bank-sync.ts`
- `packages/desktop-client/src/components/banksync/bankSyncUtils.ts`
- provider gating/config files

### PR 2: Add sync-server Plaid configuration and secrets plumbing

Goal:

- Introduce Plaid app credentials storage and provider route mounting

Likely files:

- `packages/sync-server/src/app.ts`
- `packages/sync-server/src/services/secrets-service.js`
- new `app-plaid` skeleton

### PR 3: Add sync-server Plaid item token storage

Goal:

- Add dedicated storage for Plaid item access tokens and metadata

Likely files:

- new migrations
- `packages/sync-server/src/account-db.js`
- new Plaid repository/service files

### PR 4: Build Plaid setup and link-token exchange flow

Goal:

- Allow authenticated users to start Plaid Link and exchange `public_token`

Likely files:

- new `packages/sync-server/src/app-plaid/*`
- `packages/desktop-client/src/plaid.ts`
- provider setup UI files

### PR 5: Fetch Plaid accounts and wire account-selection modal

Goal:

- Surface Plaid accounts in the existing `SelectLinkedAccountsModal`

Likely files:

- `packages/desktop-client/src/components/modals/SelectLinkedAccountsModal.tsx`
- `packages/desktop-client/src/accounts/mutations.ts`
- `packages/loot-core/src/server/accounts/app.ts`

### PR 6: Add Plaid account-link handler in loot-core

Goal:

- Persist linked-account metadata and trigger initial sync

Likely files:

- `packages/loot-core/src/server/accounts/app.ts`
- `packages/loot-core/src/server/accounts/link.ts`

### PR 7: Add Plaid transactions/balances adapter

Goal:

- Download Plaid data and convert it into Actual's normalized bank-sync response

Likely files:

- `packages/loot-core/src/server/accounts/sync.ts`
- `packages/sync-server/src/app-plaid/*`

### PR 8: Add Plaid error mapping

Goal:

- Map Plaid auth/item errors into existing sync statuses

Likely files:

- `packages/sync-server/src/app-plaid/errors.ts`
- `packages/loot-core/src/server/accounts/app.ts`

### PR 9: Add unlink/relink behavior

Goal:

- Remove or disable local Plaid linkage safely and define whether remote item revocation happens automatically

Likely files:

- `packages/loot-core/src/server/accounts/app.ts`
- `packages/sync-server/src/app-plaid/*`

### PR 10: Add tests and fixture coverage

Goal:

- Lock down matching, balance updates, initial sync, relink, and error handling

Likely files:

- `packages/loot-core/src/server/accounts/app-bank-sync.test.ts`
- new sync-server Plaid tests
- desktop-client provider flow tests

### PR 11: Optional webhook support

Goal:

- Add webhook-triggered invalidation or background sync for better freshness

Likely files:

- `packages/sync-server/src/app-plaid/*`
- new webhook verification logic

---

## Testing Strategy

## Unit tests

### Loot core

Test:

- Plaid provider dispatch in `accounts/sync.ts`
- normalization into Actual transaction shape
- imported id stability
- first sync starting-balance logic
- pending vs booked transaction behavior
- fuzzy matching fallback still works
- sync-status mapping

Best locations:

- `packages/loot-core/src/server/accounts/app-bank-sync.test.ts`
- new dedicated Plaid sync tests near `accounts/sync.ts`

### Sync server

Test:

- link token creation
- public token exchange
- item token persistence
- account list normalization
- transaction normalization
- balance normalization
- Plaid error mapping
- webhook verification if added later

Best locations:

- new tests under `packages/sync-server/src/app-plaid/`

### Desktop client

Test:

- provider card visibility
- setup state handling
- account selection flow
- link mutation wiring
- reset/reconfigure behavior

Best locations:

- bank sync component tests in `packages/desktop-client/src/components/banksync/`

## Integration tests

Recommended:

- mock Plaid responses at the sync-server boundary
- verify that a Plaid-linked account creates expected Actual transactions
- verify relink and reauth-required states

## Manual QA

Test scenarios:

- new account link
- linking to existing account
- initial import with starting balance
- subsequent sync without duplicates
- modified pending transaction becoming booked
- sync after deleting local imported transaction
- broken credential / item revoked
- unlink and relink
- multi-account Plaid item
- off-budget linked account

---

## Key Implementation Rules

1. Do not change budgeting logic.
2. Do not change reconciliation semantics unless a Plaid-specific bug forces it.
3. Do not store Plaid access tokens in the budget database.
4. Reuse `raw_synced_data`, `imported_id`, and existing matching rules.
5. Reuse existing sync statuses and error UX.
6. Keep Plaid logic provider-scoped so other providers remain untouched.

---

## Final Recommendation

If the goal is to add Plaid safely, the best path is:

1. Add Plaid as a new built-in provider
2. Keep provider auth and token exchange in `sync-server`
3. Keep linked-account metadata and reconciliation in `loot-core`
4. Reuse the existing bank sync UI and account-link modal
5. Introduce a dedicated sync-server table for Plaid item tokens
6. Ship in small PRs, with sync-server token storage before transaction import work

That path preserves Actual's strongest asset: the existing local-first budgeting and reconciliation engine.
