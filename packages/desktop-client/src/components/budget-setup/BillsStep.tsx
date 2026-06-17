import React, { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgAdd } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import type { BudgetSetupCalculatorDraft } from '@actual-app/core/types/prefs';
import { format as formatDate } from 'date-fns';

import { LabeledCheckbox } from '#components/forms/LabeledCheckbox';

import { AllocationSection } from './AllocationSection';
import type {
  BudgetMath,
  BudgetSetupCalculatorRowDraft,
  RecurringBillSuggestion,
} from './budgetSetupTypes';
import { makeRow } from './budgetSetupUtils';
import { SectionCard } from './SectionCard';

type BillsStepProps = {
  draft: BudgetSetupCalculatorDraft;
  billSuggestions: RecurringBillSuggestion[];
  isPending: boolean;
  budgetMath: BudgetMath;
  groupOptions: Array<readonly [string, string]>;
  categoryOptions: Array<readonly [string, string]>;
  groupById: Record<string, CategoryGroupEntity>;
  categoryById: Record<string, CategoryEntity>;
  dateFormat: string;
  formatAmount: (amount: number) => string;
  onChangeDraft: (
    updater: (d: BudgetSetupCalculatorDraft) => BudgetSetupCalculatorDraft,
  ) => void;
};

export function BillsStep({
  draft,
  billSuggestions,
  isPending,
  budgetMath,
  groupOptions,
  categoryOptions,
  groupById,
  categoryById,
  dateFormat,
  formatAmount,
  onChangeDraft,
}: BillsStepProps) {
  const { t } = useTranslation();

  const selectedBillKeys = useMemo(
    () => new Set(draft.selectedSuggestedBillKeys),
    [draft.selectedSuggestedBillKeys],
  );

  function toggleSuggestion(
    suggestion: RecurringBillSuggestion,
    checked: boolean,
  ) {
    onChangeDraft(d => {
      const nextKeys = checked
        ? [...new Set([...d.selectedSuggestedBillKeys, suggestion.key])]
        : d.selectedSuggestedBillKeys.filter(k => k !== suggestion.key);

      let nextBills = d.bills;
      if (checked) {
        if (!d.bills.some(r => r.suggestionKey === suggestion.key)) {
          nextBills = [
            ...d.bills,
            {
              ...makeRow(suggestion.name, 'suggested'),
              amount: suggestion.averageAmount,
              suggestionKey: suggestion.key,
            },
          ];
        }
      } else {
        nextBills = d.bills.filter(r => r.suggestionKey !== suggestion.key);
      }

      return { ...d, selectedSuggestedBillKeys: nextKeys, bills: nextBills };
    });
  }

  function addBillRow() {
    onChangeDraft(d => ({ ...d, bills: [...d.bills, makeRow()] }));
  }

  function changeRow(rowId: string, nextRow: BudgetSetupCalculatorRowDraft) {
    onChangeDraft(d => ({
      ...d,
      bills: d.bills.map(r => (r.id === rowId ? nextRow : r)),
    }));
  }

  function removeRow(rowId: string) {
    onChangeDraft(d => {
      const removed = d.bills.find(r => r.id === rowId);
      return {
        ...d,
        bills: d.bills.filter(r => r.id !== rowId),
        selectedSuggestedBillKeys: removed?.suggestionKey
          ? d.selectedSuggestedBillKeys.filter(k => k !== removed.suggestionKey)
          : d.selectedSuggestedBillKeys,
      };
    });
  }

  return (
    <>
      {/* Suggested bills */}
      <SectionCard
        title={t('Step 4 — Suggested bills')}
        subtitle={t(
          'These recurring expenses were detected from recent history across all accounts. Check the ones that are real fixed bills.',
        )}
      >
        {isPending ? (
          <Text style={{ color: theme.pageTextLight }}>
            {t('Scanning recent transactions...')}
          </Text>
        ) : billSuggestions.length === 0 ? (
          <Text style={{ color: theme.pageTextLight }}>
            {t(
              'No recurring patterns detected yet. Add manual bill rows below.',
            )}
          </Text>
        ) : (
          <View>
            {billSuggestions.map(s => (
              <View
                key={s.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  paddingTop: 8,
                  paddingBottom: 8,
                  borderBottom: '1px solid ' + theme.tableBorder,
                }}
              >
                <LabeledCheckbox
                  id={`bill-suggestion-${s.key}`}
                  checked={selectedBillKeys.has(s.key)}
                  onChange={e => toggleSuggestion(s, e.currentTarget.checked)}
                >
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontWeight: 500 }}>{s.name}</Text>
                    <Text style={{ color: theme.pageTextLight, fontSize: 12 }}>
                      <Trans>
                        Avg <strong>{formatAmount(s.averageAmount)}</strong> ·{' '}
                        {s.occurrences}× seen · last{' '}
                        {formatDate(
                          monthUtils.parseDate(s.lastSeenDate),
                          dateFormat,
                        )}{' '}
                        · confidence <strong>{s.confidenceLabel}</strong>
                      </Trans>
                    </Text>
                  </View>
                </LabeledCheckbox>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      {/* Manual bill rows */}
      <AllocationSection
        sectionKey="bills"
        title={t('Fixed bill rows')}
        subtitle={t(
          'Each selected suggestion appears here as an editable row. Add manual rows for anything not suggested.',
        )}
        rows={draft.bills}
        budgetMath={budgetMath}
        groupOptions={groupOptions}
        categoryOptions={categoryOptions}
        groupById={groupById}
        categoryById={categoryById}
        onAddRow={addBillRow}
        onChangeRow={changeRow}
        onRemoveRow={removeRow}
        formatAmount={formatAmount}
      />
    </>
  );
}
