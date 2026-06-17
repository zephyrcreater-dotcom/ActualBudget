import React, { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type {
  AccountEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';
import type { BudgetSetupCalculatorDraft } from '@actual-app/core/types/prefs';
import { format as formatDate } from 'date-fns';

import { Checkbox } from '#components/forms';
import { LabeledCheckbox } from '#components/forms/LabeledCheckbox';

import type { CandidateInflow, IncomeEstimate } from './budgetSetupTypes';
import {
  extractDisplayPayee,
  extractRawDescription,
  getInflowTags,
} from './budgetSetupUtils';
import { SectionCard } from './SectionCard';
import { SummaryRow } from './SummaryRow';

type IncomeStepProps = {
  accounts: AccountEntity[];
  draft: BudgetSetupCalculatorDraft;
  allInflowTransactions: readonly TransactionEntity[];
  isPending: boolean;
  payeesById: Record<string, { name: string; transfer_acct?: string | null }>;
  accountNameById: Record<string, string>;
  incomeEstimate: IncomeEstimate;
  formatAmount: (amount: number) => string;
  dateFormat: string;
  onChangeDraft: (
    updater: (d: BudgetSetupCalculatorDraft) => BudgetSetupCalculatorDraft,
  ) => void;
};

type PeriodPreset = '1m' | '2m' | '3m' | 'custom';

function getPeriodPreset(start: string, end: string): PeriodPreset {
  const today = monthUtils.currentDay();
  if (end !== today) return 'custom';
  const startOf1m = monthUtils.firstDayOfMonth(
    monthUtils.subMonths(monthUtils.monthFromDate(today), 1),
  );
  const startOf2m = monthUtils.firstDayOfMonth(
    monthUtils.subMonths(monthUtils.monthFromDate(today), 2),
  );
  const startOf3m = monthUtils.firstDayOfMonth(
    monthUtils.subMonths(monthUtils.monthFromDate(today), 3),
  );
  if (start === startOf1m) return '1m';
  if (start === startOf2m) return '2m';
  if (start === startOf3m) return '3m';
  return 'custom';
}

function getPresetDates(preset: PeriodPreset): { start: string; end: string } {
  const today = monthUtils.currentDay();
  const currentMonth = monthUtils.monthFromDate(today);
  if (preset === '1m') {
    return {
      start: monthUtils.firstDayOfMonth(monthUtils.subMonths(currentMonth, 1)),
      end: today,
    };
  }
  if (preset === '2m') {
    return {
      start: monthUtils.firstDayOfMonth(monthUtils.subMonths(currentMonth, 2)),
      end: today,
    };
  }
  return {
    start: monthUtils.firstDayOfMonth(monthUtils.subMonths(currentMonth, 3)),
    end: today,
  };
}

export function IncomeStep({
  accounts,
  draft,
  allInflowTransactions,
  isPending,
  payeesById,
  accountNameById,
  incomeEstimate,
  formatAmount,
  dateFormat,
  onChangeDraft,
}: IncomeStepProps) {
  const { t } = useTranslation();

  const onBudgetAccounts = useMemo(
    () => accounts.filter(a => !a.offbudget && !a.closed),
    [accounts],
  );

  const preset = getPeriodPreset(
    draft.analysisStartDate,
    draft.analysisEndDate,
  );

  const selectedAccountIds = new Set(draft.incomeAccountIds);
  const selectedIncomeIds = new Set(draft.incomeTransactionIds);

  const candidateInflows = useMemo<CandidateInflow[]>(() => {
    const sourceTransactions =
      draft.incomeAccountIds.length > 0
        ? allInflowTransactions.filter(t => selectedAccountIds.has(t.account))
        : allInflowTransactions;

    return sourceTransactions
      .filter(t => !t.starting_balance_flag && !t.tombstone && !t.parent_id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(t => {
        const displayPayee = extractDisplayPayee(
          t,
          payeesById,
          accountNameById,
        );
        return {
          ...t,
          displayPayee,
          accountName: accountNameById[t.account] || t.account,
          rawDescription: extractRawDescription(t),
          tags: getInflowTags(t, displayPayee),
        };
      });
  }, [
    allInflowTransactions,
    draft.incomeAccountIds,
    payeesById,
    accountNameById,
    selectedAccountIds,
  ]);

  function toggleAccount(accountId: string, checked: boolean) {
    onChangeDraft(d => ({
      ...d,
      incomeAccountIds: checked
        ? [...d.incomeAccountIds, accountId]
        : d.incomeAccountIds.filter(id => id !== accountId),
    }));
  }

  function applyPreset(p: PeriodPreset) {
    if (p === 'custom') return;
    const { start, end } = getPresetDates(p);
    onChangeDraft(d => ({
      ...d,
      analysisStartDate: start,
      analysisEndDate: end,
      incomeTransactionIds: [],
    }));
  }

  function setCustomDate(
    field: 'analysisStartDate' | 'analysisEndDate',
    value: string,
  ) {
    onChangeDraft(d => ({
      ...d,
      [field]: value,
      incomeTransactionIds: [],
    }));
  }

  function toggleIncome(transactionId: string, checked: boolean) {
    onChangeDraft(d => ({
      ...d,
      incomeTransactionIds: checked
        ? [...d.incomeTransactionIds, transactionId]
        : d.incomeTransactionIds.filter(id => id !== transactionId),
    }));
  }

  const PRESETS: Array<{ key: PeriodPreset; label: string }> = [
    { key: '1m', label: t('1 month') },
    { key: '2m', label: t('2 months') },
    { key: '3m', label: t('3 months') },
    { key: 'custom', label: t('Custom') },
  ];

  return (
    <>
      {/* Account selection */}
      <SectionCard
        title={t('Step 1 — Income accounts')}
        subtitle={t(
          'Select the account(s) where your income is deposited. Usually your checking or direct deposit account.',
        )}
      >
        {onBudgetAccounts.length === 0 ? (
          <Text style={{ color: theme.pageTextLight }}>
            {t('No on-budget accounts found.')}
          </Text>
        ) : (
          <View style={{ gap: 6 }}>
            {onBudgetAccounts.map(account => (
              <LabeledCheckbox
                key={account.id}
                id={`income-account-${account.id}`}
                checked={selectedAccountIds.has(account.id)}
                onChange={e =>
                  toggleAccount(account.id, e.currentTarget.checked)
                }
              >
                {account.name}
              </LabeledCheckbox>
            ))}
          </View>
        )}
        {draft.incomeAccountIds.length === 0 && onBudgetAccounts.length > 0 && (
          <Text style={{ color: theme.noticeText, fontSize: 12, marginTop: 4 }}>
            <Trans>
              No accounts selected — showing inflows from all accounts.
            </Trans>
          </Text>
        )}
      </SectionCard>

      {/* Analysis period */}
      <SectionCard
        title={t('Step 2 — Analysis period')}
        subtitle={t(
          'Choose the date range to look for income transactions. 3 months gives a stable estimate.',
        )}
      >
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <Button
              key={p.key}
              variant={preset === p.key ? 'primary' : 'normal'}
              onPress={() => applyPreset(p.key)}
              style={{ padding: '4px 12px', fontSize: 13 }}
            >
              {p.label}
            </Button>
          ))}
        </View>
        {preset === 'custom' && (
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginTop: 4,
            }}
          >
            <View
              style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}
            >
              <Text style={{ color: theme.pageTextLight, fontSize: 13 }}>
                <Trans>From</Trans>
              </Text>
              <Input
                value={draft.analysisStartDate}
                placeholder="YYYY-MM-DD"
                onChangeValue={v => setCustomDate('analysisStartDate', v)}
                style={{ width: 120 }}
              />
            </View>
            <View
              style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}
            >
              <Text style={{ color: theme.pageTextLight, fontSize: 13 }}>
                <Trans>To</Trans>
              </Text>
              <Input
                value={draft.analysisEndDate}
                placeholder="YYYY-MM-DD"
                onChangeValue={v => setCustomDate('analysisEndDate', v)}
                style={{ width: 120 }}
              />
            </View>
          </View>
        )}
        {preset !== 'custom' && (
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            {formatDate(
              monthUtils.parseDate(draft.analysisStartDate),
              'MMM d, yyyy',
            )}{' '}
            →{' '}
            {formatDate(
              monthUtils.parseDate(draft.analysisEndDate),
              'MMM d, yyyy',
            )}
          </Text>
        )}
      </SectionCard>

      {/* Transaction list */}
      <SectionCard
        title={t('Step 3 — Select income transactions')}
        subtitle={t(
          'Check only true income — payroll deposits, side income, etc. Transfers and refunds should be left unchecked.',
        )}
      >
        {/* Income estimate */}
        {incomeEstimate.selectedTotal > 0 && (
          <View
            style={{
              backgroundColor: theme.tableBackground,
              border: '1px solid ' + theme.tableBorder,
              borderRadius: 4,
              padding: '8px 12px',
              gap: 4,
            }}
          >
            <SummaryRow
              label={t('Selected income total')}
              value={formatAmount(incomeEstimate.selectedTotal)}
            />
            {incomeEstimate.monthsCovered > 1 && (
              <SummaryRow
                label={t('Period covered')}
                value={`${incomeEstimate.monthsCovered.toFixed(1)} months`}
              />
            )}
            <SummaryRow
              label={t('Estimated monthly income')}
              value={formatAmount(incomeEstimate.estimatedMonthly)}
              isBold
            />
            {incomeEstimate.firstDate &&
              incomeEstimate.firstDate !== incomeEstimate.lastDate && (
                <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                  {formatDate(
                    monthUtils.parseDate(incomeEstimate.firstDate),
                    'MMM d',
                  )}
                  {' — '}
                  {formatDate(
                    monthUtils.parseDate(incomeEstimate.lastDate),
                    'MMM d, yyyy',
                  )}
                </Text>
              )}
          </View>
        )}

        {isPending ? (
          <Text style={{ color: theme.pageTextLight }}>
            {t('Loading transactions...')}
          </Text>
        ) : candidateInflows.length === 0 ? (
          <Text style={{ color: theme.pageTextLight }}>
            {draft.incomeAccountIds.length === 0
              ? t('Select an income account above to see inflows.')
              : t('No inflows found for the selected account(s) and period.')}
          </Text>
        ) : (
          <View>
            {candidateInflows.map(transaction => {
              const checked = selectedIncomeIds.has(transaction.id);
              return (
                <View
                  key={transaction.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 10,
                    paddingTop: 8,
                    paddingBottom: 8,
                    borderBottom: '1px solid ' + theme.tableBorder,
                  }}
                >
                  <Checkbox
                    id={`income-tx-${transaction.id}`}
                    checked={checked}
                    onChange={e =>
                      toggleIncome(transaction.id, e.currentTarget.checked)
                    }
                    style={{ marginTop: 3, flexShrink: 0 }}
                  />
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {transaction.displayPayee || t('Unknown payee')}
                      </Text>
                      <Text
                        style={{
                          ...styles.tnum,
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                      >
                        {formatAmount(transaction.amount)}
                      </Text>
                    </View>
                    <Text style={{ color: theme.pageTextLight, fontSize: 12 }}>
                      {formatDate(
                        monthUtils.parseDate(transaction.date),
                        dateFormat,
                      )}{' '}
                      · {transaction.accountName}
                    </Text>
                    {transaction.rawDescription &&
                      transaction.rawDescription !==
                        transaction.displayPayee && (
                        <Text
                          style={{ color: theme.pageTextSubdued, fontSize: 11 }}
                        >
                          {transaction.rawDescription}
                        </Text>
                      )}
                    {transaction.tags.length > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 5,
                          flexWrap: 'wrap',
                          marginTop: 2,
                        }}
                      >
                        {transaction.tags.map(tag => (
                          <Text
                            key={tag}
                            style={{
                              fontSize: 11,
                              color: theme.noticeText,
                              backgroundColor: theme.noticeBackground,
                              borderRadius: 3,
                              padding: '1px 5px',
                            }}
                          >
                            {tag}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </SectionCard>
    </>
  );
}
