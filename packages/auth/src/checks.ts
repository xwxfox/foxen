import type { Session } from 'better-auth';
import type { AuthCheck } from './context';
import { UnauthorizedError, type AuthError } from './errors';

type BooleanKey<T> = {
  [K in keyof T]: T[K] extends boolean ? K : never;
}[keyof T];

const extractRoles = (session: Session): string[] | null => {
  const roles = (session as { roles?: unknown }).roles;
  if (!Array.isArray(roles)) return null;
  return roles.every((role) => typeof role === 'string') ? roles : null;
};

/**
 * Common reusable auth checks
 */
export const CommonChecks = {
  /**
   * Check if user has a specific property set to true
   */
  hasProperty: <TSession extends Session, K extends BooleanKey<TSession>>(
    property: K,
    error?: AuthError
  ): AuthCheck<TSession> => ({
    check: ({ session }) => session?.[property] === true,
    checkError: error ?? new UnauthorizedError(`Property '${String(property)}' required`),
    isRequired: true,
  }),

  /**
   * Check if user has a role
   */
  hasRole: <TSession extends Session>(role: string, error?: AuthError): AuthCheck<TSession> => ({
    check: ({ session }) => {
      const roles = extractRoles(session);
      return Boolean(roles?.includes(role));
    },
    checkError: error ?? new UnauthorizedError(`Role '${role}' required`),
    isRequired: true,
  }),

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole: <TSession extends Session>(roles: string[], error?: AuthError): AuthCheck<TSession> => ({
    check: ({ session }) => {
      const userRoles = extractRoles(session);
      return Array.isArray(userRoles) && roles.some((role) => userRoles.includes(role));
    },
    checkError: error ?? new UnauthorizedError('One of the required roles is needed'),
    isRequired: true,
  }),

  /**
   * Check if user has all specified roles
   */
  hasAllRoles: <TSession extends Session>(roles: string[], error?: AuthError): AuthCheck<TSession> => ({
    check: ({ session }) => {
      const userRoles = extractRoles(session);
      return Array.isArray(userRoles) && roles.every((role) => userRoles.includes(role));
    },
    checkError: error ?? new UnauthorizedError('All specified roles required'),
    isRequired: true,
  }),

  /**
   * Custom predicate check
   */
  custom: <TSession extends Session>(
    predicate: (session: TSession) => boolean | Promise<boolean>,
    error?: AuthError
  ): AuthCheck<TSession> => ({
    check: ({ session }) => predicate(session),
    checkError: error ?? new UnauthorizedError('Custom check failed'),
    isRequired: true,
  }),
};