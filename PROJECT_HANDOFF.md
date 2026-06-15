# Project Handoff

## 1. Project Identity

- Repo name/path:
  - `ActualBudget`
  - `/Users/nathanielstahmer/actual`
- Current branch:
  - `nathaniel-ai-budget`
- Upstream repo:
  - `https://github.com/actualbudget/actual.git`
- Fork repo:
  - `https://github.com/zephyrcreater-dotcom/ActualBudget.git`
- Current worktree state:
  - clean at handoff time
- Product direction:
  - This fork is evolving into `Nathaniel Budget`, a modestly enhanced Actual Budget fork.
  - Actual’s local-first budgeting engine remains the product foundation.
  - The fork direction is dashboard-first, practical, and budgeting-centric.
  - Hosted extensions such as Plaid, Supabase Auth, and limited AI support should be layered around the existing core instead of replacing it.

---

## 2. Current Philosophy

- Actual Budget remains the core budgeting app.
- AI is not the primary product.
- AI is only intended for `Can I Afford This?` and other what-if scenarios where normal budget math alone is not enough.
- Regular budget math, category balances, cash flow, and upcoming obligations should remain the source of truth.
- Any future AI feature should consume trusted computed values from Actual instead of re-deriving financial logic independently.
- The product should continue to feel like Actual with thoughtful extensions, not a separate AI finance app layered on top.

---

## 3. What Has Been Changed So Far

### Product and shell changes

- Rebranded visible app strings from `Actual Budget` to `Nathaniel Budget`.
- Added a new top-level `Dashboard` route.
- Made `Dashboard` the default landing page after opening a budget.
- Preserved the existing `Budget` page and its workflows.
- Added an `Investments` placeholder route.
- Removed AI as a primary sidebar item.
- Repositioned AI from “main feature” to a secondary planning utility.

### Dashboard work

- Built a new native-feeling dashboard shell that is visually closer to Actual.
- Removed the earlier AI-first framing and made the dashboard more understated and budgeting-focused.
- Added cards for:
  - Net Worth
  - Available to Budget
  - Monthly Spending
  - Cash Flow
  - Recent Transactions
  - Budget Progress
  - Can I Afford This?
  - Retirement Progress placeholder
- Replaced fake placeholder balances and transactions with real Actual data for:
  - Net Worth
  - Available to Budget
  - Monthly Spending
  - Cash Flow
  - Recent Transactions
  - Budget Progress

### Can I Afford This

- Replaced the earlier placeholder with a first real math-first affordability tool.
- Added a form with:
  - purchase name
  - purchase amount
  - category
  - payment method
  - timing
  - optional financing payment
- Uses existing Actual data to evaluate:
  - category available balance
  - available to budget
  - remaining monthly cash flow
  - whether the category would go negative
  - whether tradeoffs or savings drawdown may be required
- No AI logic was added.

### Stability fix

- Fixed a startup lifecycle regression where the app could mount the new finance shell too early.
- Root cause:
  - `App.tsx` switched to `FinancesApp` as soon as metadata exposed a budget id.
  - That allowed the new dashboard shell to render before the existing startup lifecycle had fully cleared the loading state.
  - The result looked like a local database initialization failure, but the real issue was shell handoff timing.
- Fix:
  - The app now waits for both:
    - a budget id
    - `app.loadingText === null`
  - `ManagementApp` remains mounted until the existing startup lifecycle completes.

### Important modified files

- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/App.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/FinancesApp.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/mobile/MobileNavTabs.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/sidebar/PrimaryButtons.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/index.html`
- `/Users/nathanielstahmer/actual/packages/desktop-client/public/site.webmanifest`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/util/error.ts`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/manager/subscribe/Bootstrap.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/manager/WelcomeScreen.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/manager/ConfigServer.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/settings/index.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/settings/Backups.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/modals/manager/ConfirmChangeDocumentDir.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/modals/manager/FilesSettingsModal.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-client/src/components/mobile/transactions/TransactionEdit.tsx`
- `/Users/nathanielstahmer/actual/packages/desktop-electron/index.ts`
- `/Users/nathanielstahmer/actual/packages/desktop-electron/package.json`
- `/Users/nathanielstahmer/actual/packages/desktop-electron/e2e/onboarding.test.ts`
- `/Users/nathanielstahmer/actual/packages/desktop-electron/extra-resources/linux/com.actualbudget.actual.metainfo.xml`

---

## 4. Important Files Created

### Documentation

- [CODEBASE_MAP.md](/Users/nathanielstahmer/actual/CODEBASE_MAP.md)
  - deep architecture map of the repository and fork roadmap
- [FORK_NOTES.md](/Users/nathanielstahmer/actual/FORK_NOTES.md)
  - current fork-specific implementation notes, startup bug analysis, and product direction
- [PLAID_INTEGRATION_PLAN.md](/Users/nathanielstahmer/actual/PLAID_INTEGRATION_PLAN.md)
  - detailed Plaid integration plan and recommended architecture

### Dashboard and affordability UI

- [DashboardPage.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/dashboard/DashboardPage.tsx)
- [DashboardCard.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/dashboard/DashboardCard.tsx)
- [CanIAffordThisPage.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/dashboard/CanIAffordThisPage.tsx)
- [PlaceholderPage.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/dashboard/PlaceholderPage.tsx)
- [AIFinancialCopilotPanel.tsx](/Users/nathanielstahmer/actual/packages/desktop-client/src/components/dashboard/AIFinancialCopilotPanel.tsx)
  - still present on disk but no longer part of normal navigation flow

### Plaid server-side scaffolding (2026-06-15)

- [Migration file](/Users/nathanielstahmer/actual/packages/sync-server/migrations/1763873700000-create-plaid-items-table.js)
  - Creates `plaid_items` and `plaid_accounts` tables
- [app-plaid/app-plaid.ts](/Users/nathanielstahmer/actual/packages/sync-server/src/app-plaid/app-plaid.ts)
  - Express app with Plaid endpoints
- [app-plaid/plaid-service.ts](/Users/nathanielstahmer/actual/packages/sync-server/src/app-plaid/plaid-service.ts)
  - Core Plaid service logic with placeholder implementations
- [app-plaid/errors.ts](/Users/nathanielstahmer/actual/packages/sync-server/src/app-plaid/errors.ts)
  - Plaid error types and error-to-sync-status mapping
- [app-plaid/util/handle-error.ts](/Users/nathanielstahmer/actual/packages/sync-server/src/app-plaid/util/handle-error.ts)
  - Express error handling middleware
- [app-plaid/README.md](/Users/nathanielstahmer/actual/packages/sync-server/src/app-plaid/README.md)
  - Comprehensive documentation of Plaid integration

---

## 5. Architecture Summary

- `packages/loot-core` should be preserved.
  - This is the core budgeting/accounting/reconciliation/reporting engine.
  - Do not casually rewrite finance logic here.
- `packages/desktop-client` is the main UI surface.
  - Dashboard, navigation, affordability tooling, and future investments pages belong here.
- `packages/sync-server` is the right place for hosted integrations.
  - Plaid
  - Supabase-backed auth/session integration
  - future server-side AI orchestration
  - household or collaboration support
- Plaid should be added alongside the existing providers, not as a provider-layer rewrite.
- Plaid access tokens must never go into the budget database.
  - app-level Plaid credentials can live in sync-server secrets
  - per-item Plaid access tokens need dedicated server-side storage
- Existing Actual report helpers, spreadsheet bindings, and transaction queries should be reused whenever possible.
- New dashboard or planning experiences should summarize trusted existing data instead of inventing duplicate finance math.

---

## 6. Validation Status

### Dashboard/Affordability Shell (Previous)

Latest recorded successful validation commands:

- `yarn workspace @actual-app/web typecheck`
- `yarn workspace @actual-app/web test`
- `yarn workspace @actual-app/web build`

Latest recorded result:

- typecheck passed
- test passed with `42 files, 686 tests passed, 1 skipped`
- build passed

### Plaid Server-Side Scaffolding (2026-06-15)

Latest recorded successful validation commands:

- `yarn workspace @actual-app/sync-server typecheck`
- `yarn workspace @actual-app/sync-server build`
- `yarn workspace @actual-app/sync-server test`

Latest recorded result:

- typecheck: `🎉 All files passed`
- build: `✓ built in 51ms` with new migration included
- test: `Test Files 43 passed (43)`, `Tests 534 passed (534)`

---

## 7. Known Issues / Caveats

- `Can I Afford This?` currently focuses on current-month budget math.
- Future-month planning is not fully implemented yet.
- Financing scenarios are only partially modeled and should be expanded later.
- Reserve/emergency impact is currently heuristic rather than a complete obligations-aware planning model.
- The dashboard now uses real data, but it should continue to stay visually native to Actual rather than becoming flashy or SaaS-like.
- `Retirement Progress` is still a placeholder.
- `Investments` is still a placeholder.
- Plaid scaffolding is complete but full integration requires:
  - Plaid SDK integration (`plaid-node`)
  - Desktop-client UI for provider setup
  - loot-core provider dispatch
  - Transaction import and reconciliation
- Supabase Auth has not been implemented yet.
- The hidden AI panel code still exists on disk, but AI is no longer part of primary navigation and should stay secondary.

---

## 8. Next Recommended Steps

Recommended order:

1. Commit the Plaid server-side scaffolding work (completed 2026-06-15).
   - The worktree has clean implementation with passing tests.
   - Continue using small, reviewable commits for future work.
2. Add Plaid SDK integration (`plaid-node`) and wire real API calls.
3. Add Plaid Link UI in `packages/desktop-client`.
4. Exchange Plaid `public_token` securely through the existing sync-server-backed flow.
5. Store Plaid item tokens server-side only.
   - Never in the budget database.
6. Import Plaid transactions through Actual’s existing import/matching/reconciliation pipeline in `packages/loot-core`.
7. Add investment and retirement tracking later, after bank sync foundation is stable.
8. Expand `Can I Afford This?` to support:
   - future months
   - financing scenarios
   - stronger obligations-aware planning

---

## 9. Suggested Next Codex Prompt

Ready-to-paste prompt for the next agent:

```text
You are continuing work on my Actual Budget fork at /Users/nathanielstahmer/actual.

Read these files first:
- /Users/nathanielstahmer/actual/PROJECT_HANDOFF.md
- /Users/nathanielstahmer/actual/PLAID_INTEGRATION_PLAN.md
- /Users/nathanielstahmer/actual/FORK_NOTES.md

Goal:
Continue Plaid integration by adding Plaid SDK and wiring real API calls. The server-side scaffolding (Phase 1) is complete.

Status:
✅ Server-side scaffolding complete with:
- Migration and table schema for plaid_items and plaid_accounts
- All endpoint stubs in sync-server
- Error handling and status mapping
- Placeholder implementations in plaid-service.ts

Tasks:
1. Add plaid-node SDK as a dependency in packages/sync-server
2. Initialize Plaid client in plaid-service.ts using app-level secrets:
   - plaid_clientId
   - plaid_secret
   - plaid_env
3. Implement real Plaid API calls for:
   - createLinkToken() - replace placeholder with real Plaid API call
   - exchangePublicToken() - swap public_token for access_token with Plaid
   - getPlaidAccounts() - fetch real accounts from Plaid, store in plaid_accounts table
4. Add error mapping from Plaid API errors to sync statuses (reauth-required, attention-required, failed)
5. Implement transaction sync placeholder that calls Plaid API (ready for Phase 4 loot-core integration)
6. Update README.md in app-plaid/ to reflect what’s now wired vs still placeholder
7. Add tests for:
   - Plaid client initialization
   - Link token creation
   - Public token exchange
   - Account fetching and storage
   - Error handling
8. Do not change loot-core or desktop-client in this phase
9. Do not create migration changes unless schema needs adjustment

Validation:
- Run: yarn workspace @actual-app/sync-server typecheck
- Run: yarn workspace @actual-app/sync-server build
- Run: yarn workspace @actual-app/sync-server test

Constraints:
- Do not create commits unless I ask.
- Keep Plaid token handling secure (no logging, no exposure to client).
- Placeholder sync implementation should be ready for loot-core dispatch.

Primary objective:
Wire Plaid SDK so the scaffolding can make real API calls.
```
