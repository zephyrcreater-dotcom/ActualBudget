import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgTrash } from '@actual-app/components/icons/v1';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { tokens } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import { css } from '@emotion/css';

import { FinancialInput } from '#components/util/FinancialInput';

import { NEW_GROUP_VALUE } from './budgetSetupTypes';
import type { PlannerRowDraft, PlannerSectionKey } from './budgetSetupTypes';
import {
  getCategoryLabel,
  getGroupLabel,
  normalizeAmount,
} from './budgetSetupUtils';

type PlannerRowEditorProps = {
  row: PlannerRowDraft;
  sectionKey: PlannerSectionKey;
  groupOptions: Array<readonly [string, string]>;
  categoryOptions: Array<readonly [string, string]>;
  groupById: Record<string, CategoryGroupEntity>;
  categoryById: Record<string, CategoryEntity>;
  onChange: (row: PlannerRowDraft) => void;
  onRemove: () => void;
};

export function PlannerRowEditor({
  row,
  sectionKey,
  groupOptions,
  categoryOptions,
  groupById,
  categoryById,
  onChange,
  onRemove,
}: PlannerRowEditorProps) {
  const { t } = useTranslation();
  const namePlaceholder =
    sectionKey === 'bills'
      ? 'Rent, power, insurance...'
      : sectionKey === 'savings'
        ? 'Goal name'
        : 'Groceries, gas, hobbies...';

  return (
    <View
      style={{
        border: '1px solid ' + theme.tableBorder,
        borderRadius: 4,
        padding: 10,
        gap: 8,
        backgroundColor: theme.tableBackground,
      }}
    >
      <View
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          [`@media (min-width: ${tokens.breakpoint_small})`]: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
          },
        })}
      >
        <Input
          value={row.name}
          placeholder={namePlaceholder}
          onChangeValue={value => onChange({ ...row, name: value })}
          style={{ flex: '1 1 160px', minWidth: 120 }}
        />
        <FinancialInput
          value={row.amount}
          onUpdate={value =>
            onChange({ ...row, amount: normalizeAmount(value) })
          }
          onChangeValue={value =>
            onChange({ ...row, amount: normalizeAmount(value) })
          }
          style={{ flex: '0 0 110px', minWidth: 90 }}
        />
        <Select
          value={row.groupId || ''}
          defaultLabel="Select group"
          options={[
            ['', 'Select group'],
            ...groupOptions,
            [NEW_GROUP_VALUE, 'Create new group'],
          ]}
          onChange={value =>
            onChange({
              ...row,
              groupId: value || null,
              newGroupName:
                value === NEW_GROUP_VALUE ? row.newGroupName || '' : '',
              categoryId: value === NEW_GROUP_VALUE ? null : row.categoryId,
            })
          }
          style={{ flex: '1 1 140px', minWidth: 120 }}
        />
        <Select
          value={row.categoryId || ''}
          defaultLabel="Select category"
          options={[['', 'Create from row name'], ...categoryOptions]}
          onChange={value =>
            onChange({
              ...row,
              categoryId: value || null,
              groupId:
                value && categoryById[value]
                  ? categoryById[value].group
                  : row.groupId,
              newGroupName:
                value && categoryById[value] ? '' : row.newGroupName,
            })
          }
          style={{ flex: '1 1 160px', minWidth: 130 }}
        />
        <Button variant="bare" onPress={onRemove} aria-label={t('Remove row')}>
          <SvgTrash style={{ width: 14, height: 14 }} />
        </Button>
      </View>

      {sectionKey === 'bills' ? (
        <Input
          value={row.dueDate || ''}
          placeholder="Due date (optional)"
          onChangeValue={value => onChange({ ...row, dueDate: value })}
          style={{ maxWidth: 180 }}
        />
      ) : null}

      {row.groupId === NEW_GROUP_VALUE ? (
        <Input
          value={row.newGroupName || ''}
          placeholder={t('New category group name')}
          onChangeValue={value => onChange({ ...row, newGroupName: value })}
        />
      ) : null}

      <Text
        style={{ color: theme.pageTextLight, lineHeight: 1.45, fontSize: 12 }}
      >
        {row.categoryId ? (
          <Trans>
            Applying will update{' '}
            <strong>{getCategoryLabel(row, categoryById, groupById)}</strong>{' '}
            for the selected month only.
          </Trans>
        ) : row.groupId ? (
          <Trans>
            Applying will create{' '}
            <strong>{row.name.trim() || 'this category'}</strong> in{' '}
            <strong>
              {getGroupLabel(row.groupId, row.newGroupName, groupById)}
            </strong>{' '}
            if needed, then budget it for the selected month.
          </Trans>
        ) : (
          <Trans>
            Pick an existing category or choose a group so this row can be
            applied safely.
          </Trans>
        )}
      </Text>
    </View>
  );
}
