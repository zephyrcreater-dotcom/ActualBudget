# Nathaniel Budget Fork Notes

## What Changed

- Rebranded visible app shell strings from `Actual` / `Actual Budget` to `Nathaniel Budget` in the web title, manifest, Electron window title, onboarding copy, settings copy, and a small set of obvious runtime messages.
- Added a new top-level `Dashboard` route and made it the default landing page after opening a budget.
- Kept the existing `Budget` page and all existing budgeting flows intact.
- Added a new placeholder dashboard experience with mock cards for:
  - Net Worth
  - Available to Budget
  - Monthly Spending
  - Cash Flow
  - Recent Transactions
  - Budget Progress
  - AI Insights
  - Retirement Progress
- Added placeholder top-level routes for:
  - `Investments`
  - `AI Copilot`
- Updated primary navigation to support the long-term product structure:
  - Dashboard
  - Budget
  - Accounts
  - Reports
  - Investments
  - AI Copilot
  - Settings
- Added a floating/collapsible placeholder panel titled `AI Financial Copilot`.

## Files Modified

- `/Users/nathanielstahmer/actual/packages/desktop-client/index.html`
- `/Users/nathanielstahmer/actual/packages/desktop-client/public/site.webmanifest`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/FinancesApp.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/mobile/MobileNavTabs.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/sidebar/PrimaryButtons.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/manager/subscribe/Bootstrap.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/manager/WelcomeScreen.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/manager/ConfigServer.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/settings/index.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/settings/Backups.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/modals/manager/ConfirmChangeDocumentDir.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/modals/manager/FilesSettingsModal.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/mobile/transactions/TransactionEdit.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/util/error.ts`
- `/Users/nathanielstahmer/actual/packages/desktop-electron/index.ts`
- `/Users/nathanielstahmer/actual/packages/desktop-electron/package.json`
- `/Users/nathanielstahmer/actual/packages/desktop-electron/e2e/onboarding.test.ts`
- `/Users/nathanielstahmer/actual/packages/desktop-electron/extra-resources/linux/com.actualbudget.actual.metainfo.xml`

## New Files Added

- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/dashboard/DashboardPage.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/dashboard/DashboardCard.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/dashboard/PlaceholderPage.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/dashboard/AIFinancialCopilotPanel.tsx`

## Future Plaid Integration

Recommended plug-in points:

- UI connection flow:
  - `packages/desktop-client/src/components/banksync/`
  - Add a Plaid provider alongside existing provider setup screens and account-link flows.
- Sync/provider orchestration:
  - `packages/loot-core/src/server/accounts/`
  - This is the safest seam for mapping Plaid institutions/accounts/transactions into Actual’s existing account and transaction engine.
- Hosted credential exchange / webhook handling:
  - `packages/sync-server/`
  - Place Plaid token exchange, item webhooks, and background sync jobs here instead of in the client.

## Future Supabase Auth Layer

Recommended implementation locations:

- Hosted auth/session integration:
  - `packages/sync-server/`
  - Add Supabase-backed authentication and session verification here.
- Client auth wiring:
  - `packages/desktop-client/src/auth/`
  - This is where route protection and auth state should adapt to Supabase sessions.
- Manager/onboarding server configuration:
  - `packages/desktop-client/src/components/manager/`
  - Good place for login, hosted mode selection, and auth bootstrap UX.

## Future AI Integration

Recommended implementation locations:

- Client UX:
  - `packages/desktop-client/src/components/dashboard/`
  - Extend the new dashboard cards with real summaries, recommendations, and anomaly callouts.
  - `packages/desktop-client/src/components/dashboard/AIFinancialCopilotPanel.tsx`
  - Natural home for the side panel, prompt launcher, and conversational shortcuts.
- Shared budget context / report data:
  - `packages/loot-core/`
  - Keep deterministic financial calculations here so AI uses trusted computed summaries instead of re-deriving numbers.
- Hosted AI orchestration:
  - `packages/sync-server/`
  - Best place for LLM calls, prompt assembly, caching, privacy controls, and tool execution against budget data.

## Guardrails Preserved In This PR

- No budgeting logic was changed.
- No reconciliation logic was changed.
- No transaction persistence or storage schema was changed.
- No sync-server behavior was changed.
- Existing `Budget`, `Accounts`, and `Reports` routes remain available.

