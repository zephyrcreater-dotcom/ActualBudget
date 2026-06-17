import React from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

type SectionCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <View
      style={{
        backgroundColor: theme.pillBackground,
        alignSelf: 'flex-start',
        alignItems: 'flex-start',
        padding: 15,
        borderRadius: 4,
        border: '1px solid ' + theme.pillBorderDark,
        width: '100%',
        gap: 12,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: 600 }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: theme.pageTextLight, lineHeight: 1.5 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
