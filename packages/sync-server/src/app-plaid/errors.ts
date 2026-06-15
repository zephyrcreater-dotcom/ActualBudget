export class PlaidError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public reason: string = 'plaid-error',
  ) {
    super(message);
    this.name = 'PlaidError';
  }
}

export class PlaidConfigurationError extends PlaidError {
  constructor(message: string) {
    super(message, 500, 'plaid-not-configured');
  }
}

export class PlaidItemNotFoundError extends PlaidError {
  constructor(itemId: string) {
    super(`Plaid item not found: ${itemId}`, 404, 'item-not-found');
  }
}

export class PlaidAuthenticationError extends PlaidError {
  constructor(message: string) {
    super(message, 401, 'authentication-failed');
  }
}

export class PlaidAuthorizationError extends PlaidError {
  constructor(message: string) {
    super(message, 403, 'authorization-failed');
  }
}

export class PlaidRateLimitError extends PlaidError {
  constructor(message: string) {
    super(message, 429, 'rate-limit-exceeded');
  }
}

/**
 * Map Plaid API error codes to sync status states
 * that loot-core already understands
 */
export function mapPlaidErrorToSyncStatus(
  errorCode: string,
): 'ok' | 'reauth-required' | 'attention-required' | 'failed' {
  switch (errorCode) {
    case 'INVALID_ACCESS_TOKEN':
    case 'ITEM_LOGIN_REQUIRED':
    case 'INSTITUTION_ERROR':
      return 'reauth-required';
    case 'RATE_LIMIT_EXCEEDED':
    case 'API_ERROR':
      return 'attention-required';
    case 'INVALID_REQUEST':
    case 'INVALID_BODY':
    case 'UNAUTHORIZED':
    case 'INVALID_CREDENTIALS':
      return 'failed';
    default:
      return 'failed';
  }
}
