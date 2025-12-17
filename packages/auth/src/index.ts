// Core exports
export { AuthHandlerBuilder, requireAuth, requireAuthSimple } from './handler';
export { CommonChecks } from './checks';
export {
  AuthError,
  UnauthenticatedError,
  UnauthorizedError,
  InvalidSessionError,
  SessionExpiredError,
} from './errors';

// Types
export type {
  Session,
  AuthContext,
  FailureContext,
  AuthCheck,
} from './context';

// Better-auth integration
export {
  createBetterAuthSessionGetter,
  type BetterAuthSession,
} from './integration';