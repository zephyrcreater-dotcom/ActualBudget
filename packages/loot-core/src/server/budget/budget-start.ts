import * as db from '#server/db';
import * as sheet from '#server/sheet';
import * as monthUtils from '#shared/months';

const BUDGET_START_DATE_PREF = 'budgetStartDate';

function isValidBudgetStartDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && monthUtils.dayFromDate(value) === value;
}

export function getBudgetStartDate(): string | null {
  const pref = db.firstSync<Pick<db.DbPreference, 'value'>>(
    'SELECT value FROM preferences WHERE id = ?',
    [BUDGET_START_DATE_PREF],
  );

  return pref?.value || null;
}

export function getBudgetStartMonth(): string | null {
  const budgetStartDate = getBudgetStartDate();
  return budgetStartDate ? monthUtils.monthFromDate(budgetStartDate) : null;
}

export function getBudgetStartDateRepr(): number | null {
  const budgetStartDate = getBudgetStartDate();
  return budgetStartDate ? db.toDateRepr(budgetStartDate) : null;
}

export function calculateBudgetStartCarryforward(): number {
  const budgetStartDateRepr = getBudgetStartDateRepr();
  if (budgetStartDateRepr == null) {
    return 0;
  }

  const rows = db.runQuery<{ amount: number }>(
    `SELECT SUM(t.amount) AS amount
       FROM v_transactions_internal_alive t
       LEFT JOIN accounts a ON a.id = t.account
      WHERE t.date < ${budgetStartDateRepr}
        AND t.is_parent = 0
        AND a.offbudget = 0`,
    [],
    true,
  );

  return rows[0]?.amount || 0;
}

export async function refreshBudgetStart(): Promise<void> {
  await sheet.loadUserBudgets(db);
  sheet.get().recomputeAll();
  await sheet.waitOnSpreadsheet();
}

export async function applyBudgetStartDate(
  {
    date,
  }: {
    date: string | null | undefined;
  },
): Promise<{ budgetStartDate: string | null; error?: 'invalid-date' }> {
  if (date && !isValidBudgetStartDate(date)) {
    return {
      budgetStartDate: getBudgetStartDate(),
      error: 'invalid-date',
    };
  }

  await db.update('preferences', {
    id: BUDGET_START_DATE_PREF,
    value: date || undefined,
  });

  await refreshBudgetStart();

  return {
    budgetStartDate: date || null,
  };
}
