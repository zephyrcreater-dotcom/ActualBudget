import { useEffect, useState } from 'react';

import * as asyncStorage from '@actual-app/core/platform/server/asyncStorage';

import { useServerURL } from '#components/ServerContext';

type PlaidStatusResponse = {
  status: string;
  data: {
    configured: boolean;
    env?: string;
    clientIdMasked?: string;
  };
};

export function usePlaidStatus() {
  const serverURL = useServerURL();
  const [configuredPlaid, setConfiguredPlaid] = useState(false);
  const [plaidEnv, setPlaidEnv] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      setIsLoading(true);
      try {
        if (!serverURL) {
          setConfiguredPlaid(false);
          setPlaidEnv('');
          setIsLoading(false);
          return;
        }

        // Get the session token for sync server authentication
        const userToken = await asyncStorage.getItem('user-token');
        if (!userToken) {
          setConfiguredPlaid(false);
          setPlaidEnv('');
          setIsLoading(false);
          return;
        }

        const response = await fetch(`${serverURL}/plaid/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ token: userToken }),
        });

        const data = (await response.json()) as PlaidStatusResponse;

        if (response.ok && data.status === 'ok') {
          setConfiguredPlaid(data.data.configured ?? false);
          setPlaidEnv(data.data.env ?? '');
        } else {
          setConfiguredPlaid(false);
          setPlaidEnv('');
        }
      } catch (error) {
        console.error('Failed to check Plaid status:', error);
        setConfiguredPlaid(false);
        setPlaidEnv('');
      } finally {
        setIsLoading(false);
      }
    }

    void checkStatus();
  }, [serverURL]);

  return {
    configuredPlaid,
    plaidEnv,
    isLoading,
  };
}
