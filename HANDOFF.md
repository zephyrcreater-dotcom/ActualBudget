## Current Branch

`nathaniel-ai-budget`

## Current Status

Budget Start Date work is partially implemented on this branch. The latest task fixed the broken Settings UI so the Budget Start Date field is editable, validates `YYYY-MM-DD`, saves without triggering the generic internal error toast, and can be cleared safely.

There are also broader in-progress branch changes for "Start Budgeting From Date / Archive Past Transactions for Analysis" that affect budget math, uncategorized counts, register display, and transaction filtering. Those changes are not yet fully validated end-to-end in the running app.

This branch also contains unrelated Plaid/linking/balance-repair work that must be left alone unless explicitly requested.

## Features Completed

- Added Budget Start Date settings UI at `packages/desktop-client/src/components/settings/BudgetStartSettings.tsx`.
- Fixed Budget Start Date input editability by using live input updates instead of blur-only updates.
- Added Budget Start Date input validation for `YYYY-MM-DD`.
- Added "Start budgeting from this month" helper that fills the first day of the current month.
- Disabled Apply when the input is empty or invalid.
- Added safe clear flow via "Clear budget start date".
- Added readable success/error notifications for Budget Start Date apply/clear.
- Added defensive frontend logging around Budget Start Date apply:
  - input value
  - parsed date
  - message/action sent to core
  - response/error
- Added core-side validation guard in `packages/loot-core/src/server/budget/budget-start.ts` so invalid dates return a readable error instead of crashing the handler.
- Verified the frontend/core preference key matches: `budgetStartDate`.
- Verified the message handler is registered in `packages/loot-core/src/server/preferences/app.ts`.
- Verified the handler is reachable through app composition in `packages/loot-core/src/server/main.ts`.

## Features In Progress

- Broader Budget Start Date architecture on this branch:
  - synced pref `budgetStartDate`
  - synced pref `registerPreBudgetFilter`
  - pre-budget transaction filtering in register queries
  - pre-budget transaction visual labeling in register lists
  - uncategorized counts filtered by Budget Start Date
  - budget math changes in `packages/loot-core/src/server/budget/base.ts`
  - envelope carryforward logic in `packages/loot-core/src/server/budget/envelope.ts`
- These broader changes compile, but still need full product-level validation with real account data and credit card behavior.

## Known Bugs

- The broader Budget Start Date feature has not yet been verified end-to-end in the live app after the recent UI fix.
- `packages/loot-core/src/server/budget-start.ts`, `packages/loot-core/src/server/app.ts`, and `packages/loot-core/src/server/index.ts` do not exist in this repo; the real implementations currently live in:
  - `packages/loot-core/src/server/budget/budget-start.ts`
  - `packages/loot-core/src/server/preferences/app.ts`
  - `packages/loot-core/src/server/main.ts`
- This branch contains many unrelated dirty files from prior work. Be careful not to treat all modified files as part of the Budget Start Date settings bug fix.

## Recent Files Changed

Latest task:
- `packages/desktop-client/src/components/settings/BudgetStartSettings.tsx`
- `packages/loot-core/src/server/budget/budget-start.ts`

Other relevant branch files already modified for the broader Budget Start Date feature:
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
- `packages/loot-core/src/types/prefs.ts`

Unrelated dirty branch files that should not be touched for Budget Start Date work unless explicitly requested:
- `packages/desktop-client/src/components/modals/SelectLinkedAccountsModal.tsx`
- `packages/desktop-client/src/components/settings/RepairPlaidBalances.tsx`
- `packages/loot-core/src/server/accounts/app.ts`
- `packages/loot-core/src/server/accounts/sync.ts`
- `packages/sync-server/src/app-plaid/app-plaid.ts`
- `packages/sync-server/src/app-plaid/plaid-service.ts`

## Important Architectural Decisions

- Budget Start Date is stored as a synced preference named `budgetStartDate`.
- Register filtering mode is stored as a synced preference named `registerPreBudgetFilter`.
- The current branch design favors computed behavior over destructive mutation of historical transactions.
- Historical transactions are intended to remain stored and visible for analysis rather than being deleted or rewritten.
- The current implementation path for the broader feature uses budget math filtering and carryforward logic, not a persisted migration that rewrites imported transactions.
- For the settings bug fix, the server handler now defensively rejects malformed dates and the UI handles that gracefully.

## Things Not To Touch

- Plaid Link
- account linking
- transaction import
- the new Plaid balance repair flow
- unrelated dirty Plaid files listed above
- user-edited categories/payees during future Budget Start Date work

## Validation Performed

Latest task:
- Confirmed the input component API: `onUpdate` fires on blur, `onChangeValue` fires on each keystroke.
- Verified Budget Start Date handler registration in `packages/loot-core/src/server/preferences/app.ts`.
- Verified handler reachability through `packages/loot-core/src/server/main.ts`.
- Verified pref key alignment between UI and core: `budgetStartDate`.
- Ran `yarn typecheck` successfully.
- Ran `yarn workspace @actual-app/web build` successfully.

Earlier branch validation:
- `yarn workspace @actual-app/core run vitest --run src/server/budget/base.test.ts` passed for the earlier budget math changes.

Not yet performed:
- manual live-app confirmation that typing `2026-06-01` works in Settings
- manual refresh/reload confirmation that the setting persists in the UI
- manual end-to-end validation of broader Budget Start Date behavior across budget pages, registers, and credit cards

## Next Recommended Task

Run a focused live-app validation of the Budget Start Date settings flow:
- Open Settings
- Type `2026-06-01`
- Confirm Apply succeeds without the generic internal error toast
- Refresh and confirm the setting persists
- Clear and confirm removal succeeds

If that passes, the next larger task is to validate the broader Budget Start Date feature against real budget behavior:
- uncategorized warnings
- current budget spending
- register filtering
- credit card balances
- carryforward math

## Exact Prompt For Next Claude Session

You are in `~/actual` on branch `nathaniel-ai-budget`.

Read `HANDOFF.md` first and treat it as authoritative.

Current priority: validate the Budget Start Date settings flow end-to-end in the running app without touching Plaid Link, Plaid sync, transaction import, or balance repair.

Specifically:
- confirm I can type `2026-06-01` into the Budget Start Date field
- confirm Apply saves without the generic internal error toast
- confirm the UI shows the date is set
- confirm refresh preserves it
- confirm Clear removes it without crashing

If the UI validation passes, move on to validating the broader Budget Start Date feature already present on this branch:
- pre-budget uncategorized transactions should not count toward warnings
- budget math should only reflect transactions on/after the start date
- older transactions should remain visible in registers
- register pre-budget filters should work
- credit card behavior should be checked carefully

Do not disturb the unrelated Plaid-related dirty files listed in `HANDOFF.md`.
