import React from 'react';
import type { ReactNode } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

type DashboardCardProps = {
  title: string;
  children: ReactNode;
};

export function DashboardCard({ title, children }: DashboardCardProps) {
  return (
    <View
      style={{
        backgroundColor: theme.cardBackground,
        border: '1px solid ' + theme.cardBorder,
        boxShadow: `0 12px 24px ${theme.cardShadow}`,
        borderRadius: 12,
        padding: 18,
        gap: 14,
        minHeight: 180,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: theme.pageTextSubdued,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      <View style={{ gap: 10, flex: 1 }}>{children}</View>
    </View>
  );
}
