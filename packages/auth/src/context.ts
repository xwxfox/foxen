import type { NextRequest } from '@foxen/core';
import type { Session } from 'better-auth';
import type { AuthError } from './errors';

export type MaybePromise<T> = T | Promise<T>;

/**
 * Context passed to success handlers and checks
 */
export interface AuthContext<TSession extends Session = Session> {
  req: NextRequest;
  session: TSession;
}

/**
 * Context passed to failure handlers
 */
export interface FailureContext {
  req: NextRequest;
  error: AuthError;
}

/**
 * Auth check configuration
 */
export interface AuthCheck<TSession extends Session = Session> {
  check: (context: AuthContext<TSession>) => MaybePromise<boolean>;
  checkError?: AuthError;
  isRequired?: boolean;
  checkFailure?: (context: AuthContext<TSession> & { error: AuthError }) => MaybePromise<void>;
}

export type { Session };