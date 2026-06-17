import * as monthUtils from '@actual-app/core/shared/months';
import type {
  CategoryEntity,
  CategoryGroupEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';
import type {
  BudgetSetupCalculatorDraft,
  BudgetSetupCalculatorState,
} from '@actual-app/core/types/prefs';
import { format as formatDate } from 'date-fns';

import {
  DEFAULT_FLEXIBLE_NAMES,
  DEFAULT_SAVINGS_NAMES,
  NEW_GROUP_VALUE,
} from './budgetSetupTypes';
import type {
  BudgetMath,
  BudgetSetupAllocationMode,
  BudgetSetupCalculatorRowDraft,
  IncomeEstimate,
  RecurringBillSuggestion,
} from './budgetSetupTypes';

export function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeRow(
  name = '',
  source: BudgetSetupCalculatorRowDraft['source'] = 'manual',
): BudgetSetupCalculatorRowDraft {
  return {
    id: makeId('row'),
    name,
    amount: 0,
    amountMode: 'fixed',
    amountPct: 0,
    categoryId: null,
    groupId: null,
    newGroupName: '',
    categoryMappingOpen: false,
    dueDate: '',
    source,
    suggestionKey: null,
  };
}

function getDefaultAnalysisDates(): { start: string; end: string } {
  const today = monthUtils.currentDay();
  const threeMonthsAgo = monthUtils.firstDayOfMonth(
    monthUtils.subMonths(monthUtils.monthFromDate(today), 3),
  );
  return { start: threeMonthsAgo, end: today };
}

export function createDefaultDraft(
  now = monthUtils.currentMonth(),
): BudgetSetupCalculatorDraft {
  const { start, end } = getDefaultAnalysisDates();
  return {
    incomeAccountIds: [],
    analysisStartDate: start,
    analysisEndDate: end,
    incomeTransactionIds: [],
    selectedSuggestedBillKeys: [],
    bills: [],
    savings: DEFAULT_SAVINGS_NAMES.map(name => makeRow(name)),
    flexible: DEFAULT_FLEXIBLE_NAMES.map(name => makeRow(name)),
  };
}

export function getPlannerState(
  state: BudgetSetupCalculatorState | undefined,
): BudgetSetupCalculatorState {
  const currentMonth = monthUtils.currentMonth();
  if (!state) {
    return {
      selectedMonth: currentMonth,
      drafts: { [currentMonth]: createDefaultDraft() },
    };
  }
  const draft = state.drafts[state.selectedMonth];
  if (draft) {
    // Migrate old drafts that lack new fields
    const migrated = {
      ...draft,
      incomeAccountIds: draft.incomeAccountIds ?? [],
      analysisStartDate:
        draft.analysisStartDate ?? getDefaultAnalysisDates().start,
      analysisEndDate: draft.analysisEndDate ?? getDefaultAnalysisDates().end,
    };
    return {
      ...state,
      drafts: { ...state.drafts, [state.selectedMonth]: migrated },
    };
  }
  return {
    ...state,
    drafts: {
      ...state.drafts,
      [state.selectedMonth]: createDefaultDraft(state.selectedMonth),
    },
  };
}

export function normalizeText(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

export function isTruthyName(value: string | null | undefined) {
  return normalizeText(value).length > 0;
}

export function getExpenseGroups(categoryGroups: CategoryGroupEntity[]) {
  return categoryGroups.filter(group => !group.is_income && !group.hidden);
}

export function extractDisplayPayee(
  transaction: TransactionEntity,
  payeesById: Record<string, { name: string; transfer_acct?: string | null }>,
  accountNameById: Record<string, string>,
) {
  const payee = transaction.payee ? payeesById[transaction.payee] : null;
  const transferAccountName = payee?.transfer_acct
    ? accountNameById[payee.transfer_acct]
    : null;
  if (transferAccountName) return transferAccountName;
  return payee?.name || transaction.imported_payee || '';
}

export function extractRawDescription(transaction: TransactionEntity) {
  if (transaction.imported_payee) return transaction.imported_payee;
  if (!transaction.raw_synced_data) return '';
  try {
    const parsed = JSON.parse(transaction.raw_synced_data) as Record<
      string,
      unknown
    >;
    const candidate = [
      parsed.original_description,
      parsed.description,
      parsed.name,
      parsed.merchant_name,
      parsed.raw_description,
    ].find(v => typeof v === 'string' && v.trim().length > 0);
    return typeof candidate === 'string'
      ? candidate
      : transaction.raw_synced_data;
  } catch {
    return transaction.raw_synced_data;
  }
}

export function getInflowTags(
  transaction: TransactionEntity,
  displayPayee: string,
) {
  const haystack = normalizeText(
    [
      displayPayee,
      transaction.imported_payee,
      transaction.notes,
      transaction.raw_synced_data,
    ]
      .filter(Boolean)
      .join(' '),
  );
  const tags: string[] = [];
  if (
    /(payroll|direct deposit|salary|paycheck|adp|gusto|rippling|workday)/.test(
      haystack,
    )
  )
    {tags.push('payroll');}
  if (
    /(zelle|venmo|cash app|paypal|transfer|ach transfer|internal transfer)/.test(
      haystack,
    )
  )
    {tags.push('transfer?');}
  if (/(refund|reversal|return)/.test(haystack)) tags.push('refund?');
  if (/(reimburse|reimbursement|expense report)/.test(haystack))
    {tags.push('reimbursement?');}
  if (/(credit card payment|autopay payment|payment thank you)/.test(haystack))
    {tags.push('credit card pmt?');}
  return tags;
}

export function buildMonthOptions() {
  const currentMonth = monthUtils.currentMonth();
  return Array.from({ length: 25 }, (_, i) => {
    const month = monthUtils.addMonths(currentMonth, i - 12);
    return [
      month,
      formatDate(monthUtils.parseDate(month), 'MMMM yyyy'),
    ] as const;
  });
}

export function computeIncomeEstimate(
  selectedTransactions: TransactionEntity[],
): IncomeEstimate {
  if (selectedTransactions.length === 0) {
    return {
      selectedTotal: 0,
      monthsCovered: 1,
      estimatedMonthly: 0,
      firstDate: '',
      lastDate: '',
    };
  }
  const dates = selectedTransactions.map(t => t.date).sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  const ms = new Date(lastDate).getTime() - new Date(firstDate).getTime();
  const daysDiff = Math.max(0, ms / (1000 * 60 * 60 * 24));
  const monthsCovered = Math.max(1, daysDiff / 30.44);

  const selectedTotal = selectedTransactions.reduce(
    (sum, t) => sum + t.amount,
    0,
  );
  const estimatedMonthly = Math.round(selectedTotal / monthsCovered);

  return {
    selectedTotal,
    monthsCovered,
    estimatedMonthly,
    firstDate,
    lastDate,
  };
}

export function computeRowAmount(
  row: BudgetSetupCalculatorRowDraft,
  context: {
    estimatedMonthlyIncome: number;
    leftoverAfterBills: number;
    leftoverAfterSavings: number;
  },
): number {
  const mode: BudgetSetupAllocationMode = row.amountMode || 'fixed';
  if (mode === 'fixed') return row.amount;
  const pct = (row.amountPct || 0) / 100;
  if (mode === 'pct-income')
    {return Math.round(context.estimatedMonthlyIncome * pct);}
  if (mode === 'pct-leftover')
    {return Math.round(context.leftoverAfterBills * pct);}
  if (mode === 'pct-remaining')
    {return Math.round(context.leftoverAfterSavings * pct);}
  return row.amount;
}

export function computeSectionTotal(
  rows: BudgetSetupCalculatorRowDraft[],
  context: {
    estimatedMonthlyIncome: number;
    leftoverAfterBills: number;
    leftoverAfterSavings: number;
  },
): number {
  return rows.reduce((sum, row) => sum + computeRowAmount(row, context), 0);
}

export function computeBudgetMath(
  estimatedMonthlyIncome: number,
  bills: BudgetSetupCalculatorRowDraft[],
  savings: BudgetSetupCalculatorRowDraft[],
  flexible: BudgetSetupCalculatorRowDraft[],
): BudgetMath {
  const billsTotal = bills.reduce((sum, r) => sum + (r.amount || 0), 0);
  const leftoverAfterBills = estimatedMonthlyIncome - billsTotal;

  const savingsContext = {
    estimatedMonthlyIncome,
    leftoverAfterBills,
    leftoverAfterSavings: 0,
  };
  const savingsTotal = computeSectionTotal(savings, savingsContext);
  const leftoverAfterSavings = leftoverAfterBills - savingsTotal;

  const flexContext = {
    estimatedMonthlyIncome,
    leftoverAfterBills,
    leftoverAfterSavings,
  };
  const flexibleTotal = computeSectionTotal(flexible, flexContext);
  const unassigned = leftoverAfterSavings - flexibleTotal;

  return {
    estimatedMonthlyIncome,
    billsTotal,
    savingsTotal,
    flexibleTotal,
    leftoverAfterBills,
    leftoverAfterSavings,
    unassigned,
  };
}

export function getNonZeroRows(rows: BudgetSetupCalculatorRowDraft[]) {
  return rows.filter(row => row.amount !== 0 || isTruthyName(row.name));
}

export function normalizeAmount(amount: number) {
  return amount < 0 ? amount * -1 : amount;
}

export function hasCategoryMapping(row: BudgetSetupCalculatorRowDraft) {
  return !!(row.categoryId || row.groupId);
}

export function getCategoryLabel(
  row: BudgetSetupCalculatorRowDraft,
  categoryById: Record<string, CategoryEntity>,
  groupById: Record<string, CategoryGroupEntity>,
) {
  if (row.categoryId) {
    const cat = categoryById[row.categoryId];
    if (!cat) return 'Missing category';
    const group = groupById[cat.group];
    return group ? `${group.name} / ${cat.name}` : cat.name;
  }
  const groupLabel = getGroupLabel(row.groupId, row.newGroupName, groupById);
  if (groupLabel) return `Create in ${groupLabel}`;
  return null;
}

export function getGroupLabel(
  groupId: string | null | undefined,
  newGroupName: string | undefined,
  groupById: Record<string, CategoryGroupEntity>,
) {
  if (!groupId) return '';
  if (groupId === NEW_GROUP_VALUE) return newGroupName?.trim() || 'new group';
  return groupById[groupId]?.name || '';
}

export function buildRecurringBillSuggestions(
  transactions: readonly TransactionEntity[],
  payeesById: Record<string, { name: string; transfer_acct?: string | null }>,
  accountNameById: Record<string, string>,
): RecurringBillSuggestion[] {
  const groups = new Map<
    string,
    {
      name: string;
      amounts: number[];
      months: Set<string>;
      lastSeenDate: string;
    }
  >();

  for (const t of transactions) {
    if (t.amount >= 0 || t.starting_balance_flag || t.tombstone || t.parent_id)
      {continue;}

    const displayPayee = extractDisplayPayee(t, payeesById, accountNameById);
    const rawDesc = extractRawDescription(t);
    const haystack = normalizeText([displayPayee, rawDesc].join(' '));

    if (
      !displayPayee ||
      /(venmo|zelle|cash app|paypal|credit card payment|refund|reimburse)/.test(
        haystack,
      )
    )
      {continue;}

    const key = normalizeText(displayPayee);
    const amount = Math.abs(t.amount);
    const month = monthUtils.monthFromDate(t.date);
    const existing = groups.get(key);

    if (existing) {
      existing.amounts.push(amount);
      existing.months.add(month);
      if (t.date > existing.lastSeenDate) existing.lastSeenDate = t.date;
    } else {
      groups.set(key, {
        name: displayPayee,
        amounts: [amount],
        months: new Set([month]),
        lastSeenDate: t.date,
      });
    }
  }

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const occurrences = group.months.size;
      if (occurrences < 2) return null;
      const avg = Math.round(
        group.amounts.reduce((s, a) => s + a, 0) / group.amounts.length,
      );
      const max = Math.max(...group.amounts);
      const min = Math.min(...group.amounts);
      const variation = avg === 0 ? 1 : (max - min) / avg;
      if (variation > 0.35) return null;

      const confidence =
        occurrences >= 4 && variation <= 0.1
          ? 'high'
          : occurrences >= 3 && variation <= 0.2
            ? 'medium'
            : 'low';

      return {
        key,
        name: group.name,
        averageAmount: avg,
        occurrences,
        confidenceLabel: confidence,
        lastSeenDate: group.lastSeenDate,
      } satisfies RecurringBillSuggestion;
    })
    .filter((s): s is RecurringBillSuggestion => !!s)
    .sort(
      (a, b) =>
        b.occurrences - a.occurrences || b.averageAmount - a.averageAmount,
    )
    .slice(0, 12);
}
