import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  SvgCalculator,
  SvgCog,
  SvgDashboard,
  SvgPiggyBank,
  SvgReports,
  SvgTarget,
  SvgWallet,
} from '@actual-app/components/icons/v1';
import { View } from '@actual-app/components/view';

import { Item } from './Item';

export function PrimaryButtons() {
  const { t } = useTranslation();

  return (
    <View style={{ flexShrink: 0 }}>
      <Item title={t('Dashboard')} Icon={SvgDashboard} to="/dashboard" />
      <Item title={t('Budget')} Icon={SvgWallet} to="/budget" />
      <Item
        title={t('Budget Setup Calculator')}
        Icon={SvgCalculator}
        to="/budget-setup"
      />
      <Item title={t('Accounts')} Icon={SvgPiggyBank} to="/accounts" />
      <Item title={t('Reports')} Icon={SvgReports} to="/reports" />
      <Item title={t('Investments')} Icon={SvgTarget} to="/investments" />
      <Item title={t('Settings')} Icon={SvgCog} to="/settings" />
    </View>
  );
}
