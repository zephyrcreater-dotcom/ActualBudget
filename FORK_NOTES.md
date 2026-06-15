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
  - Can I Afford This?
  - Retirement Progress
- Added a placeholder top-level route for `Investments`.
- Updated primary navigation to support the long-term product structure:
  - Dashboard
  - Budget
  - Accounts
  - Reports
  - Investments
  - Settings
- Reworked the dashboard shell to feel closer to Actual’s existing visual language.
- Added a small `Can I Afford This?` planning utility route that is launched from the dashboard instead of primary navigation.
- Replaced the dashboard’s hardcoded placeholder balances, spending totals, and mock transactions with live data from Actual’s existing account, transaction, report, and budget-sheet layers.

## Dashboard Data Sources

The dashboard now uses Actual’s existing data model instead of custom fork-only calculations:

- Net Worth:
  - `packages/desktop-client/src/hooks/useAccounts.ts`
  - `packages/desktop-client/src/components/reports/spreadsheets/net-worth-spreadsheet.ts`
  - Uses the same account and net-worth report logic as Actual’s existing reports.
- Available to Budget:
  - `packages/desktop-client/src/components/budget/envelope/EnvelopeBudgetComponents.tsx`
  - `packages/desktop-client/src/spreadsheet/bindings.ts` via `envelopeBudget.toBudget`
  - Reads the live envelope budget month value directly from the spreadsheet binding layer.
- Monthly Spending:
  - `packages/desktop-client/src/components/reports/spreadsheets/spending-spreadsheet.ts`
  - Uses the existing spending report pipeline for current-month spending and comparison-to-last-month behavior.
- Cash Flow:
  - `packages/desktop-client/src/components/reports/spreadsheets/cash-flow-spreadsheet.tsx`
  - Uses Actual’s existing cash-flow helper for on-budget income and spending totals.
- Recent Transactions:
  - `packages/desktop-client/src/hooks/useTransactions.ts`
  - `packages/desktop-client/src/queries/index.ts`
  - `packages/desktop-client/src/hooks/useDisplayPayee.tsx`
  - Pulls live on-budget transactions and formats payees using the same transaction query layer the app already uses elsewhere.
- Budget Progress:
  - Envelope budget:
    - `packages/desktop-client/src/components/reports/spreadsheets/budget-analysis-spreadsheet.ts`
    - `packages/desktop-client/src/spreadsheet/bindings.ts`
  - Tracking budget fallback:
    - `packages/desktop-client/src/components/budget/tracking/TrackingBudgetComponents.tsx`
    - `packages/desktop-client/src/spreadsheet/bindings.ts`
  - This keeps the dashboard anchored to the same month calculations the budget and reporting views already trust.

## Architectural Lesson From This Step

- The dashboard should consume existing report helpers, sheet bindings, and transaction queries whenever possible.
- New presentation layers should summarize trusted values that Actual already computes instead of re-implementing finance math in the dashboard itself.
- Placeholder product areas such as investments, retirement tracking, and affordability guidance should remain clearly secondary until they can be backed by real data paths.

## Startup Fix

- Fixed a startup lifecycle regression in `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/App.tsx`.
- Root cause:
  - `AppInner` switched from `ManagementApp` to `FinancesApp` as soon as metadata exposed a budget `id`.
  - That happened before the existing bootstrap lifecycle had fully cleared `app.loadingText`, which meant the new dashboard shell could mount while the budget file and prefs were still hydrating.
  - The original manager shell is the part of the app designed to own the loading screen during startup; bypassing it too early created an initialization race.
- Fix:
  - `FinancesApp` now waits for both `budgetId` and `app.loadingText === null`.
  - While startup is still in progress, `ManagementApp` stays mounted and continues to own the existing loading/boot sequence.
- Architectural lesson:
  - Future dashboard work should not mount top-level finance routes, side panels, or data queries until the existing app-ready and budget-ready lifecycle has completed.
  - The safest seam for shell changes is after `loadBudget` and `loadPrefs` have finished, not merely when metadata first contains a budget id.

## Product Direction

- Actual-style budgeting remains the primary product experience.
- The dashboard should feel like a modest extension of Actual, not a separate AI application layered on top.
- AI is only intended as a support tool for affordability and what-if questions.
- Regular budget math, category balances, cash flow, and existing budget rules should be preferred wherever possible.
- The former floating AI panel was removed from normal app usage and related AI UI should stay secondary to the main budgeting workflow.

## Files Modified

- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/App.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/index.html`
- `/Users/nathanielstahmer/actual/packages/desktop-client/public/site.webmanifest`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/FinancesApp.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/mobile/MobileNavTabs.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/sidebar/PrimaryButtons.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/dashboard/CanIAffordThisPage.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/dashboard/DashboardCard.tsx`
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
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/dashboard/CanIAffordThisPage.tsx`

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
  - Extend the dashboard cards with real summaries, planning helpers, and affordability workflows.
  - `packages/desktop-client/src/components/dashboard/CanIAffordThisPage.tsx`
  - Good home for optional what-if guidance after the underlying budget math is established.
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
