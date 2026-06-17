import createDebug from 'debug';

const debug = createDebug('actual:plaid-error-handler');

export function handleError(handler: (req: any, res: any) => Promise<any>) {
  return async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (error) {
      const err = error as any;

      // Plaid SDK wraps API errors in err.response.data — extract all fields.
      const plaidData = err?.response?.data;
      const plaidErrorCode: string | undefined = plaidData?.error_code;
      const plaidErrorType: string | undefined = plaidData?.error_type;
      const plaidErrorMessage: string | undefined = plaidData?.error_message;
      const plaidDisplayMessage: string | undefined =
        plaidData?.display_message;
      const httpStatus: number = err?.response?.status ?? 500;

      // Build a human-readable detail string that includes the Plaid error code
      // so the UI can show "TRIAL_CONNECTION_LIMIT" instead of "plaid-error".
      let details: string;
      if (plaidErrorCode) {
        details = [
          plaidErrorCode,
          plaidErrorType ? `(${plaidErrorType})` : null,
          plaidDisplayMessage || plaidErrorMessage || null,
        ]
          .filter(Boolean)
          .join(' ');
      } else {
        details = err?.message || String(error);
      }

      console.error(
        '[Plaid] handleError:',
        'HTTP',
        httpStatus,
        '| error_code:',
        plaidErrorCode ?? '(none)',
        '| error_type:',
        plaidErrorType ?? '(none)',
        '| message:',
        plaidErrorMessage ?? err?.message ?? '(none)',
        '| display:',
        plaidDisplayMessage ?? '(none)',
      );
      debug(`Error in Plaid handler: ${details}`);

      const statusCode =
        err?.statusCode ?? (httpStatus >= 400 ? httpStatus : 500);

      return res
        .status(statusCode >= 100 && statusCode < 600 ? statusCode : 500)
        .send({
          status: 'error',
          reason: plaidErrorCode ?? err.reason ?? 'plaid-error',
          details,
          ...(plaidErrorCode && {
            plaid: {
              error_code: plaidErrorCode,
              error_type: plaidErrorType,
              error_message: plaidErrorMessage,
              display_message: plaidDisplayMessage,
            },
          }),
        });
    }
  };
}
