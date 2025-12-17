/**
 * Base authentication error class
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    // biome-ignore lint/style/noInferrableTypes: sshhh
    public statusCode: number = 403,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class UnauthenticatedError extends AuthError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHENTICATED', 401);
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'UNAUTHORIZED', 403);
  }
}

export class InvalidSessionError extends AuthError {
  constructor(message = 'Invalid or expired session') {
    super(message, 'INVALID_SESSION', 401);
  }
}

export class SessionExpiredError extends AuthError {
  constructor(message = 'Session has expired') {
    super(message, 'SESSION_EXPIRED', 401);
  }
}