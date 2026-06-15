import * as asyncStorage from '@actual-app/core/platform/server/asyncStorage';
import type { AccountEntity } from '@actual-app/core/types/models';
import type { SyncServerPlaidAccount } from '@actual-app/core/types/models/plaid';
import { t } from 'i18next';

import { pushModal } from './modals/modalsSlice';
import type { AppDispatch } from './redux/store';

type PlaidExchangeResponse = {
  status: string;
  data: {
    itemId: string;
    institutionId?: string;
    institutionName?: string;
    status: string;
  };
};

type PlaidAccountsResponse = {
  status: string;
  data: {
    accounts: SyncServerPlaidAccount[];
  };
};

type PlaidLinkTokenResponse = {
  status: string;
  data: {
    linkToken: string;
  };
};

export async function callSyncServer(
  serverURL: string,
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  if (!serverURL) {
    throw new Error(t('Sync server not configured'));
  }

  // Get the session token for sync server authentication
  const userToken = await asyncStorage.getItem('user-token');
  if (!userToken) {
    throw new Error(t('Not authenticated with sync server'));
  }

  const response = await fetch(`${serverURL}/plaid${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ token: userToken, ...body }),
  });

  const data = await response.json();

  if (!response.ok || data.status === 'error') {
    throw new Error(
      data.data?.details ||
        data.reason ||
        data.error_message ||
        t('Plaid API error'),
    );
  }

  return data;
}

async function _authorize(
  dispatch: AppDispatch,
  {
    onSuccess,
    onClose,
  }: {
    onSuccess: (data: {
      accounts: SyncServerPlaidAccount[];
      itemId: string;
      institutionId?: string;
      institutionName?: string;
    }) => Promise<void>;
    onClose?: () => void;
  },
) {
  dispatch(
    pushModal({
      modal: {
        name: 'plaid-link',
        options: {
          onSuccess,
          onClose,
        },
      },
    }),
  );
}

export async function authorizeBank(
  dispatch: AppDispatch,
  upgradingAccountId?: AccountEntity['id'],
) {
  _authorize(dispatch, {
    onSuccess: async data => {
      dispatch(
        pushModal({
          modal: {
            name: 'select-linked-accounts',
            options: {
              externalAccounts: data.accounts,
              itemId: data.itemId,
              syncSource: 'plaid',
              upgradingAccountId,
            },
          },
        }),
      );
    },
  });
}

export async function createLinkToken(
  serverURL: string,
  userId: string,
): Promise<string> {
  const resp = (await callSyncServer(serverURL, '/create-link-token', {
    userId,
  })) as PlaidLinkTokenResponse;

  return resp.data.linkToken;
}

export async function exchangePublicToken(
  serverURL: string,
  publicToken: string,
): Promise<{
  itemId: string;
  institutionId?: string;
  institutionName?: string;
}> {
  const resp = (await callSyncServer(serverURL, '/exchange-public-token', {
    publicToken,
  })) as PlaidExchangeResponse;

  return {
    itemId: resp.data.itemId,
    institutionId: resp.data.institutionId,
    institutionName: resp.data.institutionName,
  };
}

export async function getPlaidAccounts(
  serverURL: string,
  itemId: string,
): Promise<SyncServerPlaidAccount[]> {
  const resp = (await callSyncServer(serverURL, '/get-plaid-accounts', {
    itemId,
  })) as PlaidAccountsResponse;

  return resp.data.accounts || [];
}

export async function savePlaidCredentials(
  serverURL: string,
  clientId: string,
  secret: string,
  env: 'sandbox' | 'development' | 'production',
): Promise<{
  message: string;
  configured: boolean;
  env: string;
}> {
  const resp = (await callSyncServer(serverURL, '/save-credentials', {
    client_id: clientId,
    secret,
    env,
  })) as any;

  return resp.data;
}

export async function clearPlaidCredentials(serverURL: string): Promise<{
  message: string;
  configured: boolean;
}> {
  const resp = (await callSyncServer(
    serverURL,
    '/clear-credentials',
    {},
  )) as any;

  return resp.data;
}
