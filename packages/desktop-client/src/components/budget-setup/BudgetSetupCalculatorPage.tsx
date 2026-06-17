import React, { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { SvgCalculator } from '@actual-app/components/icons/v1';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { tokens } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import type {
  BudgetSetupCalculatorDraft,
  BudgetSetupCalculatorState,
} from '@actual-app/core/types/prefs';
import { css } from '@emotion/css';
import { useQueryClient } from '@tanstack/react-query';
import { format as formatDate } from 'date-fns';

import {
  categoryQueries,
  useBudgetActions,
  useCreateCategoryGroupMutation,
  useCreateCategoryMutation,
} from '#budget';
import { Page } from '#components/Page';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { useLocalPref } from '#hooks/useLocalPref';
import { usePayeesById } from '#hooks/usePayees';
import { useTransactions } from '#hooks/useTransactions';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

import { AllocationSection } from './AllocationSection';
import { BillsStep } from './BillsStep';
import type { BudgetSetupCalculatorRowDraft } from './budgetSetupTypes';
import { NEW_GROUP_VALUE } from './budgetSetupTypes';
import {
  buildMonthOptions,
  buildRecurringBillSuggestions,
  computeBudgetMath,
  computeIncomeEstimate,
  createDefaultDraft,
  extractDisplayPayee,
  extractRawDescription,
  getCategoryLabel,
  getExpenseGroups,
  getGroupLabel,
  getInflowTags,
  getNonZeroRows,
  getPlannerState,
  makeRow,
  normalizeText,
} from './budgetSetupUtils';
import { BudgetSummaryPanel } from './BudgetSummaryPanel';
import { IncomeStep } from './IncomeStep';
import { SectionCard } from './SectionCard';

type PlannerSectionKey = 'bills' | 'savings' | 'flexible';

export function BudgetSetupCalculatorPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const { data: accounts = [] } = useAccounts();
  const { data: payeesById = {} } = usePayeesById();
  const {
    data: { grouped: categoryGroups = [], list: categories = [] } = {
      grouped: [],
      list: [],
    },
  } = useCategories();

  const [storedState, setStoredState] = useLocalPref(
    'budgetSetupCalculator.state',
  );
  const [plannerState, setPlannerState] = useState<BudgetSetupCalculatorState>(
    () => getPlannerState(storedState),
  );
  const [isApplying, setIsApplying] = useState(false);

  const createCategoryMutation = useCreateCategoryMutation();
  const createCategoryGroupMutation = useCreateCategoryGroupMutation();
  const budgetActions = useBudgetActions();

  useEffect(() => {
    setPlannerState(getPlannerState(storedState));
  }, [storedState]);

  function commitState(next: BudgetSetupCalculatorState) {
    setPlannerState(next);
    setStoredState(next);
  }

  function updateDraft(
    updater: (d: BudgetSetupCalculatorDraft) => BudgetSetupCalculatorDraft,
  ) {
    const base = getPlannerState(plannerState);
    const draft = base.drafts[base.selectedMonth] || createDefaultDraft();
    commitState({
      ...base,
      drafts: { ...base.drafts, [base.selectedMonth]: updater(draft) },
    });
  }

  const selectedMonth = plannerState.selectedMonth;
  const draft = plannerState.drafts[selectedMonth] || createDefaultDraft();

  const accountNameById = useMemo(
    () => Object.fromEntries(accounts.map(a => [a.id, a.name])),
    [accounts],
  );

  const groupById = useMemo(
    () => Object.fromEntries(categoryGroups.map(g => [g.id, g])),
    [categoryGroups],
  );

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c])),
    [categories],
  );

  const expenseGroups = useMemo(
    () => getExpenseGroups(categoryGroups),
    [categoryGroups],
  );

  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const groupOptions = useMemo(
    () => expenseGroups.map(g => [g.id, g.name] as const),
    [expenseGroups],
  );

  const categoryOptions = useMemo(
    () =>
      expenseGroups.flatMap(g =>
        (g.categories || [])
          .filter(c => !c.hidden)
          .map(c => [c.id, `${g.name} / ${c.name}`] as const),
      ),
    [expenseGroups],
  );

  // Query inflows for selected date range (all on-budget accounts)
  const inflowQuery = useMemo(
    () =>
      q('transactions')
        .options({ splits: 'grouped' })
        .filter({
          'account.offbudget': false,
          date: {
            $gte: draft.analysisStartDate,
            $lte: draft.analysisEndDate,
          },
          amount: { $gt: 0 },
        })
        .select('*'),
    [draft.analysisStartDate, draft.analysisEndDate],
  );

  const { transactions: inflowTransactions, isPending: inflowsPending } =
    useTransactions({
      query: inflowQuery,
      options: { pageSize: 500, refetchOnSync: true },
    });

  // Query all negative transactions for bill suggestions (last 6 months)
  const billHistoryQuery = useMemo(
    () =>
      q('transactions')
        .options({ splits: 'grouped' })
        .filter({
          'account.offbudget': false,
          date: {
            $gte: monthUtils.firstDayOfMonth(
              monthUtils.subMonths(
                monthUtils.monthFromDate(monthUtils.currentDay()),
                6,
              ),
            ),
            $lte: monthUtils.currentDay(),
          },
          amount: { $lt: 0 },
        })
        .select('*'),
    [],
  );

  const { transactions: billHistoryTransactions, isPending: billsPending } =
    useTransactions({
      query: billHistoryQuery,
      options: { pageSize: 600, refetchOnSync: true },
    });

  const billSuggestions = useMemo(
    () =>
      buildRecurringBillSuggestions(
        billHistoryTransactions,
        payeesById,
        accountNameById,
      ),
    [billHistoryTransactions, payeesById, accountNameById],
  );

  // Income estimate from selected transactions
  const selectedIncomeTransactions = useMemo(() => {
    const selectedIds = new Set(draft.incomeTransactionIds);
    return inflowTransactions.filter(t => selectedIds.has(t.id));
  }, [inflowTransactions, draft.incomeTransactionIds]);

  const incomeEstimate = useMemo(
    () => computeIncomeEstimate(selectedIncomeTransactions),
    [selectedIncomeTransactions],
  );

  // Budget math
  const budgetMath = useMemo(
    () =>
      computeBudgetMath(
        incomeEstimate.estimatedMonthly,
        draft.bills,
        draft.savings,
        draft.flexible,
      ),
    [
      incomeEstimate.estimatedMonthly,
      draft.bills,
      draft.savings,
      draft.flexible,
    ],
  );

  // Unmapped rows (have name/amount but no category mapping)
  const unmappedRows = useMemo(() => {
    const allRows = [
      ...getNonZeroRows(draft.bills),
      ...getNonZeroRows(draft.savings),
      ...getNonZeroRows(draft.flexible),
    ];
    return allRows.filter(r => !r.categoryId && !r.groupId);
  }, [draft.bills, draft.savings, draft.flexible]);

  function setSelectedMonth(month: string) {
    const base = getPlannerState(plannerState);
    commitState({
      ...base,
      selectedMonth: month,
      drafts: {
        ...base.drafts,
        [month]: base.drafts[month] || createDefaultDraft(),
      },
    });
  }

  function updateSection(
    sectionKey: PlannerSectionKey,
    rowId: string,
    nextRow: BudgetSetupCalculatorRowDraft,
  ) {
    updateDraft(d => ({
      ...d,
      [sectionKey]: d[sectionKey].map(r => (r.id === rowId ? nextRow : r)),
    }));
  }

  function addSection(sectionKey: PlannerSectionKey) {
    updateDraft(d => ({
      ...d,
      [sectionKey]: [...d[sectionKey], makeRow()],
    }));
  }

  function removeSection(sectionKey: PlannerSectionKey, rowId: string) {
    updateDraft(d => ({
      ...d,
      [sectionKey]: d[sectionKey].filter(r => r.id !== rowId),
    }));
  }

  async function resolveGroupId(
    row: BudgetSetupCalculatorRowDraft,
    groups: CategoryGroupEntity[],
  ): Promise<string | null> {
    if (!row.groupId) return null;
    if (row.groupId !== NEW_GROUP_VALUE) return row.groupId;
    const name = row.newGroupName?.trim() || '';
    if (!name) return null;
    const existing = groups.find(
      g => normalizeText(g.name) === normalizeText(name),
    );
    if (existing) return existing.id;
    const id = await createCategoryGroupMutation.mutateAsync({ name });
    if (!id) throw new Error(`Could not create group "${name}".`);
    groups.push({ id, name, is_income: false, categories: [] });
    return id;
  }

  async function resolveCategoryId(
    row: BudgetSetupCalculatorRowDraft,
    groups: CategoryGroupEntity[],
    cats: CategoryEntity[],
  ): Promise<string | null> {
    if (row.categoryId) return row.categoryId;
    const groupId = await resolveGroupId(row, groups);
    const catName = row.name.trim();
    if (!groupId || !catName) return null;
    const existing = cats.find(
      c =>
        c.group === groupId && normalizeText(c.name) === normalizeText(catName),
    );
    if (existing) return existing.id;
    const id = await createCategoryMutation.mutateAsync({
      name: catName,
      groupId,
      isIncome: false,
      isHidden: false,
    });
    if (!id) throw new Error(`Could not create category "${catName}".`);
    cats.push({
      id,
      name: catName,
      group: groupId,
      is_income: false,
      hidden: false,
    });
    return id;
  }

  async function applyDraft() {
    setIsApplying(true);
    try {
      const latest = await queryClient.ensureQueryData(categoryQueries.list());
      const mutableGroups = latest.grouped
        .filter(g => !g.is_income)
        .map(g => ({ ...g, categories: [...(g.categories || [])] }));
      const mutableCats = latest.list
        .filter(c => !c.is_income)
        .map(c => ({ ...c }));

      const allRows = [
        ...getNonZeroRows(draft.bills),
        ...getNonZeroRows(draft.savings),
        ...getNonZeroRows(draft.flexible),
      ];

      const budgetAmounts = new Map<string, number>();
      const resolvedUpdates = new Map<string, BudgetSetupCalculatorRowDraft>();
      const skipped: string[] = [];

      for (const row of allRows) {
        // Skip rows with no mapping intent
        if (!row.categoryId && !row.groupId) {
          skipped.push(row.name || 'Untitled');
          continue;
        }
        const categoryId = await resolveCategoryId(
          row,
          mutableGroups,
          mutableCats,
        );
        if (!categoryId) {
          skipped.push(row.name || 'Untitled');
          continue;
        }
        resolvedUpdates.set(row.id, {
          ...row,
          categoryId,
          groupId:
            mutableCats.find(c => c.id === categoryId)?.group || row.groupId,
          newGroupName: '',
        });
        budgetAmounts.set(
          categoryId,
          (budgetAmounts.get(categoryId) || 0) + Math.abs(row.amount),
        );
      }

      for (const [categoryId, amount] of budgetAmounts.entries()) {
        await budgetActions.mutateAsync({
          month: selectedMonth,
          type: 'budget-amount',
          args: { category: categoryId, amount },
        });
      }

      // Persist resolved category ids back into draft
      updateDraft(d => ({
        ...d,
        bills: d.bills.map(r => resolvedUpdates.get(r.id) || r),
        savings: d.savings.map(r => resolvedUpdates.get(r.id) || r),
        flexible: d.flexible.map(r => resolvedUpdates.get(r.id) || r),
      }));

      const appliedCount = budgetAmounts.size;
      const month = formatDate(
        monthUtils.parseDate(selectedMonth),
        'MMMM yyyy',
      );
      let message = t('Applied {{count}} category budget(s) to {{month}}.', {
        count: appliedCount,
        month,
      });
      if (skipped.length > 0) {
        message +=
          ' ' +
          t('Skipped {{count}} unmapped row(s): {{rows}}.', {
            count: skipped.length,
            rows:
              skipped.slice(0, 3).join(', ') + (skipped.length > 3 ? '…' : ''),
          });
      }

      dispatch(
        addNotification({
          notification: {
            type: appliedCount > 0 ? 'message' : 'warning',
            message,
          },
        }),
      );
    } catch (err) {
      console.error('Budget Setup Calculator apply error', err);
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t(
              'Error applying draft budget. Your transactions and history were not changed.',
            ),
            pre: err instanceof Error ? err.message : undefined,
          },
        }),
      );
    } finally {
      setIsApplying(false);
    }
  }

  const formatAmount = (amount: number) => format(amount, 'financial');

  return (
    <Page
      header={
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginLeft: 20,
          }}
        >
          <SvgCalculator style={{ width: 18, height: 18 }} />
          <Text style={{ fontSize: 25, fontWeight: 500 }}>
            {t('Budget Calculator')}
          </Text>
        </View>
      }
    >
      {/* Month selector bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingTop: 10,
          paddingBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <Text style={{ color: theme.pageTextLight, fontSize: 13 }}>
          <Trans>Planning for:</Trans>
        </Text>
        <Select
          value={selectedMonth}
          options={monthOptions}
          onChange={setSelectedMonth}
          style={{ minWidth: 180 }}
        />
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          <Trans>Drafts are saved per month on this device.</Trans>
        </Text>
      </View>

      {/* Two-column layout on desktop */}
      <View
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          paddingBottom: 40,
          alignItems: 'stretch',
          [`@media (min-width: ${tokens.breakpoint_medium})`]: {
            flexDirection: 'row',
            alignItems: 'flex-start',
          },
        })}
      >
        {/* Left column: workflow steps */}
        <View
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            flex: '1 1 0',
            minWidth: 0,
          })}
        >
          <IncomeStep
            accounts={accounts}
            draft={draft}
            allInflowTransactions={inflowTransactions}
            isPending={inflowsPending}
            payeesById={payeesById}
            accountNameById={accountNameById}
            incomeEstimate={incomeEstimate}
            formatAmount={formatAmount}
            dateFormat={dateFormat}
            onChangeDraft={updateDraft}
          />

          <BillsStep
            draft={draft}
            billSuggestions={billSuggestions}
            isPending={billsPending}
            budgetMath={budgetMath}
            groupOptions={groupOptions}
            categoryOptions={categoryOptions}
            groupById={groupById}
            categoryById={categoryById}
            dateFormat={dateFormat}
            formatAmount={formatAmount}
            onChangeDraft={updateDraft}
          />

          <AllocationSection
            sectionKey="savings"
            title={t('Step 5 — Savings & investments')}
            subtitle={t(
              'Roth IRA, brokerage, emergency fund, car fund, travel, etc. Use % of leftover to allocate dynamically.',
            )}
            rows={draft.savings}
            budgetMath={budgetMath}
            groupOptions={groupOptions}
            categoryOptions={categoryOptions}
            groupById={groupById}
            categoryById={categoryById}
            onAddRow={() => addSection('savings')}
            onChangeRow={(id, row) => updateSection('savings', id, row)}
            onRemoveRow={id => removeSection('savings', id)}
            formatAmount={formatAmount}
          />

          <AllocationSection
            sectionKey="flexible"
            title={t('Step 6 — Flexible spending')}
            subtitle={t(
              "Groceries, dining, gas, hobbies, shopping, etc. Use % of remainder to split what's left after savings.",
            )}
            rows={draft.flexible}
            budgetMath={budgetMath}
            groupOptions={groupOptions}
            categoryOptions={categoryOptions}
            groupById={groupById}
            categoryById={categoryById}
            onAddRow={() => addSection('flexible')}
            onChangeRow={(id, row) => updateSection('flexible', id, row)}
            onRemoveRow={id => removeSection('flexible', id)}
            formatAmount={formatAmount}
          />
        </View>

        {/* Right column: sticky summary */}
        <View
          className={css({
            width: '100%',
            [`@media (min-width: ${tokens.breakpoint_medium})`]: {
              width: '280px',
              flexShrink: 0,
              position: 'sticky',
              top: '20px',
            },
          })}
        >
          <BudgetSummaryPanel
            selectedMonth={selectedMonth}
            incomeEstimate={incomeEstimate}
            budgetMath={budgetMath}
            unmappedRowCount={unmappedRows.length}
            isApplying={isApplying}
            formatAmount={formatAmount}
            onApply={() => {
              void applyDraft();
            }}
          />
        </View>
      </View>
    </Page>
  );
}
