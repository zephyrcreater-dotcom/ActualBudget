import createDebug from 'debug';

const debug = createDebug('actual:plaid-error-handler');

export function handleError(handler: (req: any, res: any) => Promise<any>) {
  return async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (error) {
      const err = error as any;
      debug(`Error in Plaid handler: ${err?.message || String(error)}`);

      if (err?.statusCode) {
        return res.status(err.statusCode).send({
          status: 'error',
          reason: err.reason || 'plaid-error',
          details: err.message,
        });
      }

      return res.status(500).send({
        status: 'error',
        reason: 'plaid-error',
        details: err?.message || 'Unknown error',
      });
    }
  };
}
