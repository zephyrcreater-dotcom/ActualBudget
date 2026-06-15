import { useEffect, useState } from 'react';

import { useServerURL } from '#components/ServerContext';

type PlaidStatusResponse = {
  status: string;
  data: {
    configured: boolean;
  };
};

export function usePlaidStatus() {
  const serverURL = useServerURL();
  const [configuredPlaid, setConfiguredPlaid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      setIsLoading(true);
      try {
        if (!serverURL) {
          setConfiguredPlaid(false);
          setIsLoading(false);
          return;
        }

        const response = await fetch(`${serverURL}/plaid/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        const data = (await response.json()) as PlaidStatusResponse;

        if (response.ok && data.status === 'ok') {
          setConfiguredPlaid(data.data.configured ?? false);
        } else {
          setConfiguredPlaid(false);
        }
      } catch (error) {
        console.error('Failed to check Plaid status:', error);
        setConfiguredPlaid(false);
      } finally {
        setIsLoading(false);
      }
    }

    void checkStatus();
  }, [serverURL]);

  return {
    configuredPlaid,
    isLoading,
  };
}
