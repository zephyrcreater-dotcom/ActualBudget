# CODEBASE_MAP

## Executive Summary

If I were building the best AI budgeting app on top of Actual, I would keep Actual's strongest asset intact: the local-first budgeting engine in `packages/loot-core`, especially the spreadsheet-driven monthly budget model, transaction normalization, rules engine, and sync-aware data model. I would avoid rewriting core budgeting behavior early. Instead, I would treat Actual as a durable financial operating system and layer new product capabilities around three seams that already exist: the bank sync provider boundary, the manager/auth shell, and the reports/dashboard framework.

The best path is not "replace Actual with a new app shell all at once." The better path is to add a new branded landing experience, new account/link/auth providers, and new reporting surfaces while preserving the existing tables, handlers, and budget calculations. Plaid should be introduced as a new sync provider alongside the current providers before any legacy provider is removed. Supabase Auth should start as a replacement for sync-server OpenID/password login in multiuser/server mode, not as a rewrite of all local/offline flows. AI should first be read-only and context-rich: budget summaries, purchase analysis, category explanations, and net worth commentary. Only after those are stable should it become action-taking.

For the fork, I would build "Nathaniel Budget" around a new dashboard-first home screen, a new provider-backed account connection flow, and a set of AI/reporting modules that reuse Actual's transaction, account, and category data. The long-term architecture should look like this:

- Keep `packages/loot-core` as the source of truth for budgeting, transactions, reports, and sync contracts.
- Keep `packages/desktop-client` as the main product shell, but introduce a new dashboard/home route and branded navigation.
- Treat `packages/sync-server` as the place for hosted capabilities: Supabase-backed auth, Plaid token exchange/webhooks, household sharing, and server-side AI orchestration.
- Use the existing dashboard/report widgets as the first place to add net worth, investment, and AI insight surfaces before creating deeper dedicated pages.

That gives you an incremental, reviewable path from "Actual fork" to "AI-first budgeting platform" without destabilizing the accounting core.

---

## 1. Repository Overview

### Monorepo shape

Actual is a Yarn 4 workspace monorepo rooted at [package.json](/Users/nathanielstahmer/actual/package.json). The main product is split across reusable packages rather than a single app folder.

High-level responsibilities:

- `packages/loot-core`: core budgeting engine, database layer, spreadsheet engine, sync client logic, server handlers, importers, rules, reports.
- `packages/desktop-client`: React web/desktop UI.
- `packages/desktop-electron`: Electron wrapper and desktop packaging.
- `packages/sync-server`: optional hosted/server component for file sync, auth, and bank-provider proxy endpoints.
- `packages/api`: public programmatic API on top of `loot-core`.
- `packages/component-library`: shared UI primitives, themes, icons, tokens, Storybook.
- `packages/crdt`: CRDT sync primitives and serialization.
- `packages/plugins-service`: service worker / plugin runtime support for the web app.
- `packages/cli`: command-line wrapper around the API.
- `packages/docs`: Docusaurus docs site.
- `packages/eslint-plugin-actual`: custom lint rules for repo conventions.
- `packages/ci-actions`: CI helper scripts.

### Important top-level folders

- `bin/`: root build and packaging scripts such as browser/desktop packaging.
- `data/`: local runtime data used in development.
- `packages/`: all workspaces.
- `scripts/`: shared repo scripts, including agent hooks.
- `upcoming-release-notes/`: release-note staging area.
- `.github/`: workflows, templates, AI/PR rules.
- `.husky/`: git hooks.
- `.yarn/`: Yarn runtime and patches.

### High-level folder tree

```text
actual/
├── bin/
├── data/
├── packages/
│   ├── api/
│   ├── ci-actions/
│   ├── cli/
│   ├── component-library/
│   ├── crdt/
│   ├── desktop-client/
│   ├── desktop-electron/
│   ├── docs/
│   ├── eslint-plugin-actual/
│   ├── loot-core/
│   ├── plugins-service/
│   └── sync-server/
├── scripts/
├── upcoming-release-notes/
├── package.json
├── lage.config.js
├── tsconfig.json
└── AGENTS.md
```

### Workspace structure

The runtime layering is roughly:

1. `loot-core` defines data types, handlers, spreadsheet/budget logic, and server-side business rules.
2. `desktop-client` calls those handlers through the client connection bridge and renders product UX.
3. `desktop-electron` embeds the web build plus the local runtime.
4. `sync-server` is a separate optional network service for sync, auth, and bank-provider APIs.
5. `api` wraps `loot-core` handlers for external automation.

The most important architectural split for your fork is this:

- Product logic lives mostly in `loot-core`.
- Product presentation lives mostly in `desktop-client`.
- Hosted capabilities live mostly in `sync-server`.

---

## 2. Frontend Architecture

### Web app entry point

Main browser entry: [packages/desktop-client/src/index.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/index.tsx)

This file:

- loads browser preload, fonts, and i18n
- creates the Redux store and TanStack Query client
- wraps the app with:
  - `QueryClientProvider`
  - Redux `Provider`
  - `ServerProvider`
  - `AuthProvider`
- mounts `<App />`

### App shell

Main shell: [packages/desktop-client/src/components/App.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/App.tsx)

`App.tsx` sets up:

- `BrowserRouter`
- hotkeys
- spreadsheet provider
- sidebar provider
- drag/drop provider
- error boundaries
- theme style injection
- modal rendering

It decides between:

- `ManagementApp` when no budget is open
- `FinancesApp` when a budget is open

That split is important for the fork:

- `ManagementApp` is the pre-budget/login/file-selection/auth area.
- `FinancesApp` is the in-product shell once a budget is active.

### Routing/navigation system

Primary finance routes live in [packages/desktop-client/src/components/FinancesApp.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/FinancesApp.tsx).

Key routes:

- `/budget`
- `/accounts`
- `/accounts/:id`
- `/reports/*`
- `/bank-sync`
- `/rules`
- `/payees`
- `/schedules`
- `/settings`
- admin-only routes like `/user-directory` and `/user-access`

Reports have their own router in [packages/desktop-client/src/components/reports/ReportRouter.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/reports/ReportRouter.tsx).

Manager/login/bootstrap routes live in [packages/desktop-client/src/components/manager/ManagementApp.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/manager/ManagementApp.tsx).

### Main layout component

The finance layout is composed in `FinancesApp`:

- `FloatableSidebar`
- main content pane
- `Titlebar`
- `Notifications`
- `BankSyncStatus`
- routed page content
- mobile nav tabs for narrow screens

Reusable page framing is in [packages/desktop-client/src/components/Page.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/Page.tsx).

`Page.tsx` abstracts:

- desktop page headers
- mobile headers
- persistent mobile header slot/portal behavior
- padding and background rules

### Sidebar implementation

Sidebar files:

- [packages/desktop-client/src/components/sidebar/index.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/sidebar/index.tsx)
- [packages/desktop-client/src/components/sidebar/Sidebar.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/sidebar/Sidebar.tsx)
- [packages/desktop-client/src/components/sidebar/SidebarProvider.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/sidebar/SidebarProvider.tsx)
- [packages/desktop-client/src/components/sidebar/PrimaryButtons.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/sidebar/PrimaryButtons.tsx)
- [packages/desktop-client/src/components/sidebar/Accounts.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/sidebar/Accounts.tsx)

Behavior:

- resizable via `re-resizable`
- can float/collapse on desktop
- auto-floats on narrow widths
- combines top-level nav with account tree
- account sections split into on-budget, off-budget, closed

For a YNAB-inspired modern shell, this is one of the cleanest UI seams to replace without touching the budget engine.

### Dashboard/home page implementation

Current report/dashboard landing area:

- [packages/desktop-client/src/components/reports/ReportsDashboardRouter.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/reports/ReportsDashboardRouter.tsx)
- [packages/desktop-client/src/components/reports/Overview.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/reports/Overview.tsx)

Behavior:

- `/reports` redirects to first dashboard page
- dashboard pages come from `dashboard_pages`
- widgets come from `dashboard`
- widget layout uses `react-grid-layout`
- default dashboard widgets are seeded from [packages/loot-core/src/shared/dashboard.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/shared/dashboard.ts)

This is already a configurable dashboard system, not a static page. That makes it the best base for a future "Nathaniel Budget" landing page.

### Theme/color/styling system

Core styling primitives:

- [packages/component-library/src/theme.ts](/Users/nathanielstahmer/actual/packages/component-library/src/theme.ts)
- [packages/component-library/src/styles.ts](/Users/nathanielstahmer/actual/packages/component-library/src/styles.ts)
- [packages/component-library/src/tokens.ts](/Users/nathanielstahmer/actual/packages/component-library/src/tokens.ts)

App-side theme application:

- [packages/desktop-client/src/style/theme.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/style/theme.tsx)
- [packages/desktop-client/src/style/customThemes.ts](/Users/nathanielstahmer/actual/packages/desktop-client/src/style/customThemes.ts)
- [packages/desktop-client/src/style/styles.ts](/Users/nathanielstahmer/actual/packages/desktop-client/src/style/styles.ts)

How it works:

- theme values are CSS variables
- base themes are `light`, `dark`, `midnight`, `auto`
- palette/base CSS is injected at runtime
- optional custom theme CSS is validated then injected on top
- component library reads from semantic tokens like `theme.pageBackground`

### Component library structure

Component library root: [packages/component-library/src](/Users/nathanielstahmer/actual/packages/component-library/src)

It includes:

- primitive layout/text controls: `View`, `Block`, `Text`, `Paragraph`, `SpaceBetween`
- form controls: `Button`, `Input`, `Select`, `Toggle`, `ColorPicker`
- interaction components: `Menu`, `Popover`, `Tooltip`
- typography/layout helpers: `AlignedText`, `InlineField`, `InitialFocus`
- icons in `src/icons/`
- theme CSS files in `src/Themes/`
- Storybook stories and MDX docs for many components

This package is a good place to add branded primitives for the fork if they are reusable across desktop, web, and potential future apps.

---

## 3. Budget Engine

### Core location

The budgeting engine lives primarily in:

- [packages/loot-core/src/server/budget](/Users/nathanielstahmer/actual/packages/loot-core/src/server/budget)
- [packages/loot-core/src/server/sheet.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/sheet.ts)
- [packages/loot-core/src/server/spreadsheet](/Users/nathanielstahmer/actual/packages/loot-core/src/server/spreadsheet)

Actual's budget is not just row-based CRUD. It is spreadsheet-backed. Monthly budget calculations are computed as spreadsheet cells backed by DB-driven inputs.

### Where accounts are modeled

Primary account model/storage:

- DB schema: [packages/loot-core/src/server/sql/init.sql](/Users/nathanielstahmer/actual/packages/loot-core/src/server/sql/init.sql)
- validation/model mapping: [packages/loot-core/src/server/models.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/models.ts)
- handlers: [packages/loot-core/src/server/accounts/app.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/accounts/app.ts)
- types: [packages/loot-core/src/types/models/account.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/types/models/account.ts)

Important account fields for the fork:

- `offbudget`
- `closed`
- `balance_current`
- `balance_available`
- `balance_limit`
- `account_sync_source`
- `bank_sync_status`
- `last_reconciled`

### Where transactions are modeled

Primary transaction logic:

- table schema: `transactions` in `init.sql`
- handlers: [packages/loot-core/src/server/transactions/app.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/transactions/app.ts)
- sync/reconciliation logic: [packages/loot-core/src/server/accounts/sync.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/accounts/sync.ts)
- split/ungroup mutation helpers: [packages/loot-core/src/shared/transactions.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/shared/transactions.ts)
- transfer mirroring: [packages/loot-core/src/server/transactions/transfer.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/transactions/transfer.ts)

Important modeling detail:

- transfers are mirrored transactions, not just flags
- split transactions are parent/child rows
- reconciliation and imports operate against normalized transaction entities

### Where category groups and categories are stored

Storage and mapping:

- `categories` and `category_groups` tables in `init.sql`
- category/group models in `models.ts`
- budget handlers and queries in [packages/loot-core/src/server/budget/app.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/budget/app.ts)

Categories are returned grouped for UI/report usage, but stored flat in tables.

### Where envelope budgeting logic is implemented

Envelope-specific formulas live in:

- [packages/loot-core/src/server/budget/envelope.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/budget/envelope.ts)

This file defines the spreadsheet cells for:

- `budget-<category>`
- `leftover-<category>`
- `leftover-pos-<category>`
- `to-budget`
- `buffered`
- `from-last-month`
- `available-funds`
- `last-month-overspent`
- `total-budgeted`
- `total-spent`
- `total-leftover`

This is the heart of Actual's envelope behavior.

### Where month rollover logic is implemented

Month creation and range expansion:

- [packages/loot-core/src/server/budget/base.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/budget/base.ts)

Rollover-related rules:

- prior-month blank sheet setup: `envelope.ts`
- carryover flag behavior: `envelope.ts`, `tracking.ts`, `actions.ts`
- budget horizon expansion: `createAllBudgets()` in `base.ts`
- carryover toggles: `setCategoryCarryover()` in `actions.ts`
- hold-for-next-month buffer: `holdForNextMonth()` and `resetHold()` in `actions.ts`

In practice:

- month rollover is mostly spreadsheet-cell dependency logic
- DB budget rows provide monthly inputs
- sheet formulas compute the rolled state

### Where reconciliation logic lives

Bank/import reconciliation lives in:

- [packages/loot-core/src/server/accounts/sync.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/accounts/sync.ts)

Manual/file import entrypoint:

- `importTransactions()` in [packages/loot-core/src/server/accounts/app.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/accounts/app.ts)

What reconciliation does:

- matches imported/synced transactions to existing rows
- creates payees if needed
- handles deleted/reimport behavior
- respects options like pending import, note import, date update, reimport deleted
- returns added/updated preview sets to the UI

This is one of the most important reuse points for Plaid and AI-driven import cleanup.

---

## 4. Bank Sync Architecture

### How bank connections currently work

There are two layers:

1. `desktop-client` manages UX, provider setup, linking modals, status, and per-account sync settings.
2. `loot-core` manages linked account records and invokes provider sync flows.
3. `sync-server` hosts provider-specific integrations and credential storage.

Supported provider family today:

- GoCardless
- SimpleFIN
- Pluggy.ai
- Enable Banking
- Akahu

Provider enum/type:

- [packages/loot-core/src/types/models/bank-sync.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/types/models/bank-sync.ts)

UI/provider registry:

- [packages/desktop-client/src/components/banksync/useBuiltInBankSyncProviders.ts](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/banksync/useBuiltInBankSyncProviders.ts)
- [packages/desktop-client/src/components/banksync/bankSyncUtils.ts](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/banksync/bankSyncUtils.ts)

Server provider routes:

- [packages/sync-server/src/app.ts](/Users/nathanielstahmer/actual/packages/sync-server/src/app.ts)

Mounted provider apps:

- `/gocardless`
- `/simplefin`
- `/pluggyai`
- `/akahu`
- `/enablebanking`

### Sync flow

Current happy path:

1. User configures provider credentials in the UI via setup modals.
2. Credentials/secrets are stored in sync-server.
3. User links an Actual account to an external account.
4. `loot-core` stores bank linkage on the account row:
   - `bank`
   - `account_id`
   - `account_sync_source`
5. Sync is triggered from the UI.
6. `loot-core/src/server/accounts/app.ts` calls `bankSync.syncAccount(...)`.
7. Provider-specific data is fetched through sync-server endpoints.
8. Provider payloads are normalized.
9. `reconcileTransactions(...)` merges them into Actual transactions.
10. Account balance/status metadata is updated.

Key core files:

- [packages/loot-core/src/server/accounts/app.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/accounts/app.ts)
- [packages/loot-core/src/server/accounts/sync.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/accounts/sync.ts)

### Import pipeline

There are two import pipelines:

#### A. File import pipeline

- UI modal: [packages/desktop-client/src/components/modals/ImportTransactionsModal/ImportTransactionsModal.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/modals/ImportTransactionsModal/ImportTransactionsModal.tsx)
- parser: [packages/loot-core/src/server/transactions/import/parse-file.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/transactions/import/parse-file.ts)

Supports:

- CSV/TSV
- OFX/QFX
- QIF
- CAMT XML

The parser produces normalized import transaction shapes, then `transactions-import` runs reconciliation.

#### B. Bank sync pipeline

- provider transaction download in sync-server/provider app
- normalized response returned to `loot-core`
- `reconcileTransactions()` performs merge/update/add logic

### Best extension point for Plaid

Best place to add Plaid is as a first-class new provider parallel to existing providers, not by bypassing the sync architecture.

Recommended implementation split:

- `packages/sync-server/src/app-plaid/`
  - Plaid Link token creation
  - public token exchange
  - item/account fetch
  - transactions sync
  - webhook ingestion
  - secret/token persistence
- `packages/loot-core/src/server/accounts/app.ts`
  - add `plaid-accounts`, `plaid-accounts-link`, `plaid-status`, `plaid-sync` style handlers
  - extend `BankSyncProviders`
- `packages/desktop-client/src/components/banksync/useBuiltInBankSyncProviders.ts`
  - register Plaid in provider cards/setup/link UX

Why this is the right seam:

- all existing provider UX already assumes provider cards + link modals
- account records already persist provider identity
- reconciliation logic is already generic enough to reuse
- sync-server is already the place for third-party credentials and callbacks

For Plaid specifically, webhooks should terminate in `sync-server`, not the client or `loot-core`.

---

## 5. Reports & Dashboard

### How reports are generated

There are two report patterns:

1. Saved/custom report definitions persisted in `custom_reports`
2. Spreadsheet-style report computation performed in the client using query + spreadsheet helpers

Key pieces:

- report CRUD handlers: [packages/loot-core/src/server/reports/app.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/reports/app.ts)
- report router/UI: [packages/desktop-client/src/components/reports/ReportRouter.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/reports/ReportRouter.tsx)
- lazy report entrypoint: [packages/desktop-client/src/components/reports/index.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/reports/index.tsx)
- report execution hook: [packages/desktop-client/src/components/reports/useReport.ts](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/reports/useReport.ts)
- report data builders: `packages/desktop-client/src/components/reports/spreadsheets/*`

This is notable: a lot of reporting math is in the client-side report spreadsheet builders, not in server-only code.

### Where dashboard widgets live

Persistence and widget taxonomy:

- handlers: [packages/loot-core/src/server/dashboard/app.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/server/dashboard/app.ts)
- default widget set: [packages/loot-core/src/shared/dashboard.ts](/Users/nathanielstahmer/actual/packages/loot-core/src/shared/dashboard.ts)
- widget queries/mutations:
  - [packages/desktop-client/src/reports/queries.ts](/Users/nathanielstahmer/actual/packages/desktop-client/src/reports/queries.ts)
  - [packages/desktop-client/src/reports/mutations.ts](/Users/nathanielstahmer/actual/packages/desktop-client/src/reports/mutations.ts)
- dashboard page UI: [packages/desktop-client/src/components/reports/Overview.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/reports/Overview.tsx)
- widget components: `packages/desktop-client/src/components/reports/reports/*Card.tsx`

Existing widget types already include:

- net worth
- cash flow
- spending
- summary
- markdown
- formula
- custom report
- sankey
- budget analysis
- balance forecast
- age of money

### How net worth is calculated

Net worth report UI:

- [packages/desktop-client/src/components/reports/reports/NetWorth.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/reports/reports/NetWorth.tsx)

Data builder:

- [packages/desktop-client/src/components/reports/spreadsheets/net-worth-spreadsheet.ts](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/reports/spreadsheets/net-worth-spreadsheet.ts)

Mechanism:

- query account transactions by interval
- compute starting balances before range start
- build interval balances per account
- aggregate to total net worth
- feed graph/table widgets

Important product note:

Current net worth is account-balance based. It does not model holdings/positions, cost basis, or retirement-specific semantics. For investment support you can either:

- keep using synthetic balance snapshots at the account level initially
- later add position-level tables and roll them up into account balances

### Best place to add a custom dashboard landing page

Best implementation point:

- add a new dedicated product route in `FinancesApp`, likely `/home` or `/dashboard`
- build the page under `packages/desktop-client/src/components/home/` or similar
- optionally seed it from the existing dashboard widget model

If you want minimum disruption, the fastest path is:

1. keep `/reports/:dashboardId` as the customizable analytics dashboard
2. add `/home` as the branded "Nathaniel Budget" landing page
3. reuse report widgets and queries inside `/home`

If you want maximum leverage from existing infrastructure, the alternative is:

- repurpose `ReportsDashboardRouter` + `Overview` as the new home and rename "Reports" in nav

My recommendation:

- do not overload `/reports` with the primary AI-first home experience
- create a new `/home` route and let `/reports` remain the analyst workspace

---

## 6. Extension Points

### Supabase Auth

Best implementation location:

- primary server integration: `packages/sync-server`
- client auth UX integration: `packages/desktop-client/src/components/manager`
- permission context bridge: `packages/desktop-client/src/auth`

Suggested approach:

- replace or augment current OpenID/password flows rather than bypassing them
- create a Supabase-backed auth adapter in sync-server
- map Supabase users/roles into existing user/session tables or replace those tables behind the same handler contract

Why here:

- `ManagementApp` already has login/bootstrap flows
- `AuthProvider` and `ProtectedRoute` are thin and easy to adapt
- sync-server already owns multiuser identity, sessions, and permissions

### Plaid integration

Best implementation location:

- new provider app under `packages/sync-server/src/app-plaid/`
- add provider handlers in `packages/loot-core/src/server/accounts/app.ts`
- add UI integration in `packages/desktop-client/src/components/banksync`

Suggested approach:

- follow the existing provider pattern exactly
- normalize Plaid transactions into the existing bank sync transaction shape before calling `reconcileTransactions`

### AI Copilot side panel

Best implementation location:

- UI shell in `packages/desktop-client/src/components`
- likely mounted in `FinancesApp` alongside `FloatableSidebar` or as a right-side inspector
- domain data access through existing queries/hooks
- server orchestration in `packages/sync-server` if you want hosted prompts, embeddings, household context, or model APIs

Suggested approach:

- start read-only
- context sources:
  - accounts
  - transactions
  - categories
  - current budget month
  - reports/dashboard widgets
- avoid coupling AI logic directly into `loot-core` at first

### Investment/retirement page

Best implementation location:

- new route/component in `packages/desktop-client/src/components`
- new data model likely in `packages/loot-core/src/server` and `src/types/models`
- optional sync-provider enrichment in `sync-server`

Suggested first version:

- treat investment accounts as off-budget or dedicated asset accounts
- build a separate route that reads balances and manual holdings
- do not force retirement constructs into the envelope budget model early

### Net worth dashboard

Best implementation location:

- phase 1: build on top of existing net worth widget/report system
- phase 2: create a branded `/home` summary using report widgets plus new cards

Suggested reuse:

- `net-worth-spreadsheet.ts`
- `NetWorthGraph.tsx`
- dashboard widget persistence in `dashboard` tables

### Budget summary generator

Best implementation location:

- UI trigger in `desktop-client`
- report/budget data sourcing from existing hooks
- AI summarization service in `sync-server` or external API layer

Best data sources:

- budget month cells from `envelope-budget-month` / `tracking-budget-month`
- report summaries
- recent transactions
- category overspend/carryover state

### Shared household support

Best implementation location:

- `packages/sync-server`

Why:

- current multiuser and file access logic already lives there
- `ServerContext`, `ProtectedRoute`, and admin pages already assume server-backed permissions
- household-level collaboration should extend server-side file/user access rather than creating a client-only sharing model

Existing useful pieces:

- user service and access tables in sync-server
- user directory and user access pages in desktop client

---

## 7. Product Roadmap

Below is a pragmatic fork roadmap designed for incremental PRs. It starts with branding and shell work, then introduces auth/banking, then AI and investments, then collaboration.

### PR 1. Fork Branding Foundation

- Goal: rename visible product strings, app name, and artwork placeholders to "Nathaniel Budget" while preserving functionality.
- Complexity: Small
- Dependencies: None
- Likely areas:
  - `packages/desktop-client`
  - `packages/desktop-electron`
  - docs/assets/config files

### PR 2. Architecture Guardrails Document

- Goal: add fork docs describing product principles, ownership boundaries, and "do not rewrite the engine" rules.
- Complexity: Small
- Dependencies: PR 1
- Likely areas:
  - repo root docs
  - `packages/docs`

### PR 3. New Home Route and Nav Entry

- Goal: introduce `/home` as a new first-class route and sidebar/nav item without removing existing budget/reports flows.
- Complexity: Medium
- Dependencies: PR 1
- Likely areas:
  - `packages/desktop-client/src/components/FinancesApp.tsx`
  - sidebar components
  - new `components/home/`

### PR 4. Dashboard-First Landing Page

- Goal: build a modern landing page using existing summary, cash flow, spending, and net worth primitives.
- Complexity: Medium
- Dependencies: PR 3
- Likely areas:
  - `packages/desktop-client/src/components/home/`
  - reports widget/query helpers

### PR 5. Feature Flag Scaffold for Fork Features

- Goal: add dedicated feature flags for Plaid, copilot, investments, home dashboard, and purchase analysis.
- Complexity: Small
- Dependencies: PR 3
- Likely areas:
  - `loot-core` prefs/types
  - `desktop-client` feature flag hook

### PR 6. Plaid Provider Skeleton

- Goal: add a new sync-server provider app and shared types for Plaid without wiring UI yet.
- Complexity: Medium
- Dependencies: PR 5
- Likely areas:
  - `packages/sync-server/src/app-plaid/`
  - `packages/loot-core/src/types/models`

### PR 7. Plaid Client Setup and Link Flow

- Goal: add provider setup/link UI and account linking flow for Plaid.
- Complexity: Large
- Dependencies: PR 6
- Likely areas:
  - bank sync UI in `desktop-client`
  - account handlers in `loot-core`
  - sync-server Plaid routes

### PR 8. Plaid Transaction Sync + Reconciliation Integration

- Goal: normalize Plaid transactions into Actual's existing reconciliation pipeline.
- Complexity: Large
- Dependencies: PR 7
- Likely areas:
  - `packages/loot-core/src/server/accounts/sync.ts`
  - `packages/loot-core/src/server/accounts/app.ts`
  - Plaid provider normalizers

### PR 9. Supabase Auth Adapter

- Goal: add Supabase-backed login/session flow in sync-server while preserving current manager UX contracts.
- Complexity: Large
- Dependencies: PR 5
- Likely areas:
  - `packages/sync-server`
  - `desktop-client/src/components/manager`
  - `desktop-client/src/auth`

### PR 10. Household Workspace Model

- Goal: extend current multiuser support into a clearer household/workspace model with roles and shared budgets.
- Complexity: Large
- Dependencies: PR 9
- Likely areas:
  - sync-server user/file access layer
  - admin screens in desktop-client

### PR 11. AI Budget Summary MVP

- Goal: generate read-only summaries like spending trends, overspending callouts, and savings insights.
- Complexity: Medium
- Dependencies: PR 4
- Likely areas:
  - `desktop-client` home/report UI
  - `sync-server` AI endpoint layer

### PR 12. "Can I Afford This?" Analysis MVP

- Goal: add a purchase-analysis flow using current cash flow, category status, and upcoming obligations.
- Complexity: Medium
- Dependencies: PR 11
- Likely areas:
  - new UI flow in `desktop-client`
  - budget/report query composition
  - server-side AI orchestration

### PR 13. Copilot Side Panel

- Goal: add a persistent assistant panel that can answer questions about budget, spending, and recent changes.
- Complexity: Large
- Dependencies: PR 11
- Likely areas:
  - `desktop-client` shell/layout
  - query hooks
  - server orchestration

### PR 14. Investment Accounts Data Model

- Goal: introduce first-pass investment account metadata and manual holding snapshots.
- Complexity: Large
- Dependencies: PR 8
- Likely areas:
  - `loot-core` DB schema/migrations/types
  - `desktop-client` investment screens

### PR 15. Investment & Retirement Page

- Goal: create a dedicated investments route for balances, allocation, retirement progress, and account summaries.
- Complexity: Large
- Dependencies: PR 14
- Likely areas:
  - new `desktop-client` route/components
  - report helpers

### PR 16. Net Worth 2.0 Dashboard

- Goal: upgrade net worth from a single report into a first-class home/dashboard experience with trends and drivers.
- Complexity: Medium
- Dependencies: PR 14, PR 15
- Likely areas:
  - home page
  - reports widgets
  - net worth spreadsheets/graphs

### PR 17. AI Transaction Explainability

- Goal: let users click a transaction/category/dashboard card and ask "why did this change?"
- Complexity: Medium
- Dependencies: PR 13
- Likely areas:
  - transaction UI
  - report drilldowns
  - AI endpoints

### PR 18. Proactive Budget Planning Assistant

- Goal: generate monthly allocation suggestions, category warnings, and rollover recommendations before month close.
- Complexity: Large
- Dependencies: PR 11, PR 13
- Likely areas:
  - budget screens
  - budget engine read models
  - AI service layer

### PR 19. Provider Consolidation and Migration Tools

- Goal: add migration helpers for moving linked accounts from legacy providers to Plaid where appropriate.
- Complexity: Medium
- Dependencies: PR 8
- Likely areas:
  - bank sync UI
  - account linkage metadata
  - server-side migration helpers

### PR 20. Nathaniel Budget Launch Polish

- Goal: unify branding, onboarding, home dashboard, auth, bank sync, AI, and investment surfaces into a cohesive product.
- Complexity: Large
- Dependencies: All prior product-facing PRs
- Likely areas:
  - `desktop-client`
  - `desktop-electron`
  - docs/onboarding

---

## Additional Notes for a Long-Term Fork

### What not to rewrite early

- `loot-core` spreadsheet budget engine
- transaction reconciliation/matching
- transfer mirroring logic
- category/rule/payee normalization

These are the hardest parts to rebuild correctly and are already battle-tested.

### Lowest-risk high-leverage seams

- new routes/components in `desktop-client`
- new provider app in `sync-server`
- new dashboard widgets using current dashboard persistence
- new report builders using current query + spreadsheet hooks

### Highest-risk areas

- changing core transaction semantics
- changing account/category table shapes without staged migrations
- replacing the budget engine rather than extending it
- intertwining AI write-actions with the ledger too early

### Suggested north-star architecture for Nathaniel Budget

- `loot-core`: financial kernel
- `sync-server`: identity, hosted sync, bank integrations, AI orchestration, household collaboration
- `desktop-client`: premium product shell and intelligence UX
- reports/dashboard system: reusable insight surface for both home and advanced analytics

