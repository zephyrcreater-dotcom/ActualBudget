## Current Branch

`nathaniel-ai-budget`

## Current Status

The Budget Setup Calculator has been fully redesigned as a guided income planner. It now supports income account selection, configurable analysis periods, monthly income estimation from selected transactions, bill suggestions from all accounts, percentage-based savings/flexible allocation, progressive category disclosure, and an apply flow that skips unmapped rows instead of blocking. Typecheck and build both pass. Live QA still needed.

The earlier Budget Start Date work is still present on this branch and still needs live-app validation. This branch also still contains unrelated Plaid/linking/balance-repair work that must be left alone unless explicitly requested.

## Features Completed

### Budget Calculator product redesign (latest)

- **Income account selection**: user picks one or more on-budget accounts to analyze; shows all accounts when none selected.
- **Analysis period**: quick presets (1m / 2m / 3m) plus custom date range; defaults to last 3 months.
- **Monthly income estimate**: computed as `selectedTotal / monthsCovered` where `monthsCovered` is derived from first→last selected transaction date (min 1 month); shows total, period, and estimated monthly side-by-side.
- **Bills from all accounts**: bill suggestions now come from all on-budget accounts, not only the income account; includes Zelle-style outflow patterns.
- **Progressive category disclosure**: rows have a collapsed "Map to category (optional)" toggle; category/group selectors only appear when expanded; apply never blocked by unmapped rows.
- **Apply skips unmapped rows**: rows without a category mapping are skipped with a clear count in the success toast rather than blocking the whole apply.
- **Percentage allocation mode**: savings and flexible rows support `$ fixed`, `% of income`, `% after bills`, `% of remainder` modes with live dollar preview.
- **Two-column desktop layout**: left column has the six workflow steps; right column has a sticky Budget Summary panel with live math and the Apply button.
- **Updated prefs schema**: `BudgetSetupCalculatorDraft` gains `incomeAccountIds`, `analysisStartDate`, `analysisEndDate`; `BudgetSetupCalculatorRowDraft` gains `amountMode`, `amountPct`, `categoryMappingOpen`; new `BudgetSetupAllocationMode` type.
- **New files**: `AllocationRow.tsx`, `AllocationSection.tsx`, `IncomeStep.tsx`, `BillsStep.tsx`, `BudgetSummaryPanel.tsx`, `PanelRow.tsx`.
- **Updated files**: `budgetSetupTypes.ts`, `budgetSetupUtils.ts`, `BudgetSetupCalculatorPage.tsx`, `prefs.ts`.
- Old draft state migrated automatically on load.
- `yarn typecheck` ✓, `yarn workspace @actual-app/web build` ✓.

### Budget Setup Calculator UI Restyle

- Replaced all custom bubble/neon/rounded styling with native Actual patterns:
  - `SectionCard` now uses `pillBackground`, `pillBorderDark`, `borderRadius: 4`, `padding: 15` (matches `Setting` component)
  - Income and bill suggestion rows use flat table-row dividers instead of bordered cards
  - Tags use `borderRadius: 3` instead of `borderRadius: 999`
  - Summary sub-cards use `tableBackground` with `borderRadius: 4`
  - `PlannerRowEditor` uses responsive flex-wrap layout via `@emotion/css` + `tokens.breakpoint_small`
- Split into separate files per one-component-per-file rule:
  - `budget-setup/budgetSetupTypes.ts` — shared types and constants
  - `budget-setup/budgetSetupUtils.ts` — pure utility functions
  - `budget-setup/SectionCard.tsx` — section container
  - `budget-setup/SummaryRow.tsx` — label/value row
  - `budget-setup/PlannerRowEditor.tsx` — individual budget row editor
  - `budget-setup/DraftSection.tsx` — section with rows + add button
  - `budget-setup/BudgetSetupCalculatorPage.tsx` — main page only
- `yarn typecheck` and `yarn workspace @actual-app/web build` both pass.

### Budget Setup Calculator (original)

- Added a permanent page at `packages/desktop-client/src/components/budget-setup/BudgetSetupCalculatorPage.tsx`.
- Added routing for `/budget-setup` in `packages/desktop-client/src/components/FinancesApp.tsx`.
- Added sidebar navigation entry in `packages/desktop-client/src/components/sidebar/PrimaryButtons.tsx`.
- Added command bar navigation entry in `packages/desktop-client/src/components/CommandBar.tsx`.
- Added local per-budget draft persistence via `LocalPrefs['budgetSetupCalculator.state']` in `packages/loot-core/src/types/prefs.ts`.
- Added month selection with draft persistence per month.
- Added recent inflow review for the selected month and prior two months:
  - manual checkbox selection only
  - no auto-counting of inflows as income
  - shows payee, date, account, amount, and raw description when available
  - shows heuristic warning tags like `possible payroll`, `transfer?`, `refund?`, `reimbursement?`, and `credit card payment?`
- Added manual planning sections for:
  - fixed bills
  - savings & investments
  - flexible spending
- Seeded the default savings/investment rows with:
  - Roth IRA
  - Brokerage
  - Emergency Fund
  - Car Fund
  - Wedding / Travel
- Seeded the default flexible rows with:
  - Groceries
  - Restaurants
  - Gas
  - Hobbies
  - Shopping
  - Giving
  - Misc
- Added simple recurring bill suggestions based on recent negative transaction history:
  - suggestions are opt-in only
  - suggestions materialize as editable bill rows
  - no automatic application
- Added category mapping behavior for planned rows:
  - select an existing category
  - or select/create a category group and auto-create the category from the row name on Apply
- Added live draft math:
  - income
  - minus bills
  - minus savings/investments
  - minus flexible spending
  - equals leftover margin
- Added draft summary by section before applying.
- Added Apply flow that:
  - resolves or creates categories/groups as needed
  - aggregates planned amounts by category
  - applies budget amounts to the selected month only
  - does not touch transactions, payees, Plaid sync, imports, or other months

### Earlier Budget Start Date Work Still On Branch

- Added Budget Start Date settings UI at `packages/desktop-client/src/components/settings/BudgetStartSettings.tsx`.
- Fixed Budget Start Date input editability by using live input updates instead of blur-only updates.
- Added Budget Start Date input validation for `YYYY-MM-DD`.
- Added "Start budgeting from this month" helper that fills the first day of the current month.
- Disabled Apply when the input is empty or invalid.
- Added safe clear flow via "Clear budget start date".
- Added readable success/error notifications for Budget Start Date apply/clear.
- Added core-side validation guard in `packages/loot-core/src/server/budget/budget-start.ts`.

## Features In Progress

- Broader Budget Start Date architecture already on this branch:
  - synced pref `budgetStartDate`
  - synced pref `registerPreBudgetFilter`
  - pre-budget transaction filtering in register queries
  - pre-budget transaction visual labeling in register lists
  - uncategorized counts filtered by Budget Start Date
  - budget math changes in `packages/loot-core/src/server/budget/base.ts`
  - envelope carryforward logic in `packages/loot-core/src/server/budget/envelope.ts`
- These broader Budget Start Date changes still need product-level validation with real data and careful credit card checks.

## Known Limitations / Follow-Ups

- Budget Setup Calculator draft persistence is local-only per budget file and per device because it uses local prefs, not synced prefs.
- The recurring bill detection is intentionally simple and heuristic-based. It is safe enough for suggestions, but not robust enough to be treated as authoritative recurring schedule detection yet.
- The new page has compile/build validation, but I did not run a live browser/app walkthrough yet.
- The Apply flow updates only the categories represented in the planner rows. It does not zero out or rebalance unrelated categories in the selected month.
- There is no special 401(k) handling yet, by request.
- There is no direct edit flow for existing category metadata from this page beyond selecting an existing category or creating a new one during Apply.

## Known Bugs / Risks

- The broader Budget Start Date feature has not yet been verified end-to-end in the live app.
- The new Budget Setup Calculator has not yet been validated with real imported/Plaid data in a running app.
- This branch contains unrelated dirty Plaid-related files from prior work. Do not treat them as part of the calculator feature.

## Recent Files Changed

UI restyle task (latest):

- `packages/desktop-client/src/components/budget-setup/BudgetSetupCalculatorPage.tsx` (main page, single component)
- `packages/desktop-client/src/components/budget-setup/budgetSetupTypes.ts` (new — shared types/constants)
- `packages/desktop-client/src/components/budget-setup/budgetSetupUtils.ts` (new — pure utility functions)
- `packages/desktop-client/src/components/budget-setup/SectionCard.tsx` (new — section container)
- `packages/desktop-client/src/components/budget-setup/SummaryRow.tsx` (new — label/value row)
- `packages/desktop-client/src/components/budget-setup/PlannerRowEditor.tsx` (new — budget row editor)
- `packages/desktop-client/src/components/budget-setup/DraftSection.tsx` (new — section with rows)

Original calculator task:

- `packages/desktop-client/src/components/budget-setup/BudgetSetupCalculatorPage.tsx`
- `packages/desktop-client/src/components/FinancesApp.tsx`
- `packages/desktop-client/src/components/sidebar/PrimaryButtons.tsx`
- `packages/desktop-client/src/components/CommandBar.tsx`
- `packages/loot-core/src/types/prefs.ts`
- `upcoming-release-notes/budget-setup-calculator.md`

Earlier relevant branch files for Budget Start Date:

- `packages/desktop-client/src/components/settings/BudgetStartSettings.tsx`
- `packages/desktop-client/src/components/settings/index.tsx`
- `packages/desktop-client/src/components/Titlebar.tsx`
- `packages/desktop-client/src/components/accounts/Account.tsx`
- `packages/desktop-client/src/components/accounts/Header.tsx`
- `packages/desktop-client/src/components/mobile/accounts/AccountTransactions.tsx`
- `packages/desktop-client/src/components/mobile/accounts/AllAccountTransactions.tsx`
- `packages/desktop-client/src/components/mobile/accounts/OffBudgetAccountTransactions.tsx`
- `packages/desktop-client/src/components/mobile/accounts/OnBudgetAccountTransactions.tsx`
- `packages/desktop-client/src/components/mobile/budget/BudgetPage.tsx`
- `packages/desktop-client/src/components/mobile/budget/UncategorizedTransactions.tsx`
- `packages/desktop-client/src/components/mobile/transactions/TransactionListItem.tsx`
- `packages/desktop-client/src/components/modals/AccountMenuModal.tsx`
- `packages/desktop-client/src/components/transactions/TransactionsTable.tsx`
- `packages/desktop-client/src/queries/index.ts`
- `packages/desktop-client/src/spreadsheet/bindings.ts`
- `packages/loot-core/src/server/budget/base.ts`
- `packages/loot-core/src/server/budget/envelope.ts`
- `packages/loot-core/src/server/budget/base.test.ts`
- `packages/loot-core/src/server/preferences/app.ts`
- `packages/loot-core/src/server/sync/index.ts`

Unrelated dirty branch files that should not be touched unless explicitly requested:

- `packages/desktop-client/src/components/modals/SelectLinkedAccountsModal.tsx`
- `packages/desktop-client/src/components/settings/RepairPlaidBalances.tsx`
- `packages/loot-core/src/server/accounts/app.ts`
- `packages/loot-core/src/server/accounts/sync.ts`
- `packages/sync-server/src/app-plaid/app-plaid.ts`
- `packages/sync-server/src/app-plaid/plaid-service.ts`

## Important Architectural Decisions

- Budget Setup Calculator is a permanent route-based page, not onboarding-only UI.
- Income selection is manual by design. No inflow is auto-counted as income.
- Transfer-like inflows are only tagged heuristically and still require manual selection.
- The calculator reads recent transaction history but does not mutate transactions, payees, account links, Plaid state, or imports.
- Draft rows can point to existing categories or create categories/groups only when Apply is pressed.
- Apply only sets budget amounts for the selected month.
- Draft persistence intentionally uses local prefs for a lightweight first pass.
- Release-note/changelog convention in this repo is `upcoming-release-notes/`; there is still no root `CHANGELOG.md`.

## Things Not To Touch

- Plaid Link
- Plaid sync behavior
- account linking
- transaction import
- the new Plaid balance repair flow
- unrelated dirty Plaid files listed above
- user-edited transactions/payees/categories outside explicit Budget Setup Calculator Apply actions

## Validation Performed

UI restyle task (latest):

- Ran `yarn typecheck` — passed (0 errors).
- Ran `yarn workspace @actual-app/web build` — passed (built in ~16s).
- No live-app walkthrough performed yet; visual QA still needed.

Original calculator task:

Earlier branch validation:

- Verified Budget Start Date handler registration in `packages/loot-core/src/server/preferences/app.ts`.
- Verified handler reachability through `packages/loot-core/src/server/main.ts`.
- Verified pref key alignment between UI and core: `budgetStartDate`.
- Ran `yarn workspace @actual-app/core run vitest --run src/server/budget/base.test.ts` for earlier budget math work.

Not yet performed:

- manual live-app walkthrough of `/budget-setup`
- manual confirmation that the page loads from the sidebar/command bar
- manual confirmation that inflow rows render with real imported data
- manual confirmation that Apply updates only the selected month in a real budget file
- manual Budget Start Date validation in the running app

## Next Recommended Task

Live-validate the redesigned Budget Calculator at `/budget-setup`.

Checklist:

- Page loads cleanly with no overlapping text
- Select CHASE COLLEGE / checking as income account → inflow list filters to that account
- Select "3 months" period → date range updates, transactions reload
- Check only payroll deposits → estimated monthly income updates correctly
- Confirm Zelle inflows are shown but not auto-checked
- Switch to bills section → confirm suggestions come from all accounts, not only checking
- Include a suggested recurring bill → it appears as an editable row
- Add a manual bill row → add row works, total updates
- Open "Map to category" on a row → group/category selectors appear
- Leave one row unmapped → Apply should skip it with a warning, not block
- Add savings rows → try `% after bills` mode → computed dollar value appears
- Add flexible rows → try `% of remainder` → updates live as savings change
- Summary panel on the right updates live throughout
- Apply button updates only the selected month’s budgets
- Switch months → each month has its own draft

## Exact Prompt For Next Claude Session

You are in `~/actual` on branch `nathaniel-ai-budget`.

Read `HANDOFF.md` first and treat it as authoritative.

Do not touch Plaid Link, Plaid sync, transaction import, account linking, budget start date, or Plaid balance repair.

Current priority: live-validate the redesigned Budget Calculator at `/budget-setup`.

Run the app with `yarn start`, open `/budget-setup`, and walk through:

1. Select an income account (e.g. checking/direct deposit).
2. Select a 3-month analysis period.
3. Check only true payroll deposits — confirm estimated monthly income updates correctly.
4. Verify bill suggestions come from all accounts (not just the income account).
5. Include a suggested bill, add a manual bill, confirm totals update.
6. Expand "Map to category" on one row — confirm selectors appear inline.
7. Leave one row unmapped — confirm Apply skips it with a warning instead of blocking.
8. Add savings rows using percentage mode — confirm live dollar preview.
9. Add flexible rows using "% of remainder" mode — confirm they update when savings change.
10. Click Apply — confirm only the selected month’s budgets change, skipped rows are noted.

If any step fails, fix the issue and update HANDOFF.md before finishing.

- confirm month selection works and drafts persist separately per month
- confirm recent inflow transactions load
- confirm no inflows are auto-selected as income
- confirm transfer-like inflows are only tagged heuristically
- add a manual bill row
- include one suggested recurring bill and edit it
- add savings and flexible rows
- confirm leftover margin updates live
- click Apply and verify only the selected month’s budget amounts change

If that passes, move on to the older Budget Start Date validation work already on this branch:

- type `2026-06-01` into the Budget Start Date field
- confirm Apply succeeds without the generic internal error toast
- confirm refresh preserves it
- confirm Clear removes it cleanly

Do not disturb the unrelated Plaid-related dirty files listed in `HANDOFF.md`.
