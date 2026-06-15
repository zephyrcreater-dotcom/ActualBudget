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

Latest recorded successful validation commands for the current dashboard/affordability shell work:

- `yarn workspace @actual-app/web typecheck`
- `yarn workspace @actual-app/web test`
- `yarn workspace @actual-app/web build`

Latest recorded result:

- typecheck passed
- test passed with `42 files, 686 tests passed, 1 skipped`
- build passed

Note:

- These are the latest successful results recorded during the recent UI/dashboard work.
- They were not re-run during this handoff-only step.

---

## 7. Known Issues / Caveats

- `Can I Afford This?` currently focuses on current-month budget math.
- Future-month planning is not fully implemented yet.
- Financing scenarios are only partially modeled and should be expanded later.
- Reserve/emergency impact is currently heuristic rather than a complete obligations-aware planning model.
- The dashboard now uses real data, but it should continue to stay visually native to Actual rather than becoming flashy or SaaS-like.
- `Retirement Progress` is still a placeholder.
- `Investments` is still a placeholder.
- Plaid integration has not been implemented yet.
- Supabase Auth has not been implemented yet.
- The hidden AI panel code still exists on disk, but AI is no longer part of primary navigation and should stay secondary.

---

## 8. Next Recommended Steps

Recommended order:

1. Commit any uncommitted work.
   - At handoff time, the worktree is clean, so there is nothing pending right now.
   - Continue using small, reviewable commits for future work.
2. Implement Plaid server-side scaffolding in `packages/sync-server`.
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
Implement the first Plaid server-side scaffolding only. Do not add the full transaction sync yet.

Tasks:
1. Inspect the existing sync-server provider pattern for:
   - GoCardless
   - SimpleFIN
   - Enable Banking
2. Add initial Plaid provider scaffolding in packages/sync-server:
   - route mounting in sync-server app
   - provider folder structure
   - placeholder handlers for status, create-link-token, exchange-public-token, accounts
3. Add any necessary secret-name definitions for app-level Plaid credentials only:
   - plaid_clientId
   - plaid_secret
   - plaid_env
4. Do not add real Plaid SDK calls yet unless the codebase already has a suitable pattern.
5. Do not change loot-core accounting logic.
6. Do not change reconciliation logic.
7. Do not store Plaid item access tokens in the budget database.
8. If item-token persistence is needed for scaffolding, put it in sync-server only and document the schema choice.
9. Create or update tests for the new sync-server scaffolding where appropriate.
10. Update PLAID_INTEGRATION_PLAN.md or FORK_NOTES.md if implementation details materially change.

Validation:
- Run the relevant sync-server and workspace tests/typechecks/build steps for the files you change.

Constraints:
- Do not create commits unless I ask.
- Do not add unrelated refactors.
- Keep the change small and architectural.

Primary objective:
Lay the foundation for Plaid in sync-server using Actual’s existing provider architecture.
```
