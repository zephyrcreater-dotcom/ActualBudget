import React from 'react';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

type SummaryRowProps = {
  label: string;
  value: string;
  isBold?: boolean;
};

export function SummaryRow({ label, value, isBold = false }: SummaryRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        minHeight: 28,
      }}
    >
      <Text style={{ fontWeight: isBold ? 700 : 400 }}>{label}</Text>
      <Text style={{ ...styles.tnum, fontWeight: isBold ? 700 : 400 }}>
        {value}
      </Text>
    </View>
  );
}
