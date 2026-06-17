import React from 'react';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

type PanelRowProps = {
  label: string;
  value: string;
  isBold?: boolean;
  isNegative?: boolean;
  indent?: boolean;
};

export function PanelRow({
  label,
  value,
  isBold,
  isNegative,
  indent,
}: PanelRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        minHeight: 24,
        paddingLeft: indent ? 12 : 0,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: isBold ? 600 : 400,
          color: indent ? theme.pageTextLight : theme.pageText,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          ...styles.tnum,
          fontSize: 13,
          fontWeight: isBold ? 600 : 400,
          color: isNegative
            ? theme.errorText
            : isBold
              ? theme.pageText
              : theme.pageTextLight,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </Text>
    </View>
  );
}
