import React from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgAdd } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';

import type { PlannerRowDraft, PlannerSectionKey } from './budgetSetupTypes';
import { PlannerRowEditor } from './PlannerRowEditor';
import { SectionCard } from './SectionCard';

type DraftSectionProps = {
  sectionKey: PlannerSectionKey;
  title: string;
  subtitle: string;
  rows: PlannerRowDraft[];
  groupOptions: Array<readonly [string, string]>;
  categoryOptions: Array<readonly [string, string]>;
  groupById: Record<string, CategoryGroupEntity>;
  categoryById: Record<string, CategoryEntity>;
  onAddRow: () => void;
  onChangeRow: (rowId: string, row: PlannerRowDraft) => void;
  onRemoveRow: (rowId: string) => void;
};

export function DraftSection({
  sectionKey,
  title,
  subtitle,
  rows,
  groupOptions,
  categoryOptions,
  groupById,
  categoryById,
  onAddRow,
  onChangeRow,
  onRemoveRow,
}: DraftSectionProps) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      {rows.length === 0 ? (
        <Text style={{ color: theme.pageTextLight }}>
          <Trans>No rows yet. Add one when you are ready.</Trans>
        </Text>
      ) : (
        <View style={{ gap: 6, width: '100%' }}>
          {rows.map(row => (
            <PlannerRowEditor
              key={row.id}
              row={row}
              sectionKey={sectionKey}
              groupOptions={groupOptions}
              categoryOptions={categoryOptions}
              groupById={groupById}
              categoryById={categoryById}
              onChange={nextRow => onChangeRow(row.id, nextRow)}
              onRemove={() => onRemoveRow(row.id)}
            />
          ))}
        </View>
      )}

      <Button
        variant="bare"
        onPress={onAddRow}
        style={{ alignSelf: 'flex-start' }}
      >
        <SvgAdd style={{ width: 12, height: 12, marginRight: 6 }} />
        <Trans>Add row</Trans>
      </Button>
    </SectionCard>
  );
}
